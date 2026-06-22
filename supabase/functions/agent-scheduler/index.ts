import { createClient } from "npm:@supabase/supabase-js@2.57.4";
import {
  correlationId as generateCorrelationId,
  structuredLog,
  errorResponse,
  successResponse,
  verifyEnvSecrets,
  verifyJWT,
} from "../_shared/utils.ts";

// ──────────────────────────────────────────────
// CORS headers
// ──────────────────────────────────────────────
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers":
    "Content-Type, Authorization, X-Client-Info, Apikey, X-Correlation-ID",
};

// ──────────────────────────────────────────────
// Environment & Client Setup
// ──────────────────────────────────────────────
const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
const supabaseServiceRoleKey =
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";

const supabase = createClient(supabaseUrl, supabaseServiceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

// ──────────────────────────────────────────────
// Configuration
// ──────────────────────────────────────────────
const MAX_DISPATCHES_PER_TICK = 20;

// ──────────────────────────────────────────────
// Map agent task to edge function name
// ──────────────────────────────────────────────
function resolveEdgeFunctionName(task: string): string | null {
  const taskToFunction: Record<string, string> = {
    QUALIFY_LEAD: "ai-engine",
    CLOSE_DEAL: "closer-engine",
    HANDLE_OBJECTION: "closer-engine",
    GENERATE_INVOICE: "invoice-pdf",
    SCHEDULE_MEETING: "meeting-scheduler",
    GENERATE_PROPOSAL: "document-engine",
    CAPTURE_LEADS: "ai-engine",
    LINKEDIN_OUTREACH: "linkedin-outbound",
    WHATSAPP_OUTREACH: "whatsapp-outbound",
    GENERATE_REPORT: "reporting-engine",
    OPS_INTELLIGENCE: "ops-intelligence",
    MIS_REPORT: "mis-engine",
  };
  return taskToFunction[task] ?? null;
}

// ──────────────────────────────────────────────
// Verify service_role authentication
// Cron jobs (Vercel Cron / pg_cron) authenticate
// using the service_role key.
// ──────────────────────────────────────────────
function isServiceRoleAuth(authHeader: string): boolean {
  if (!authHeader || !authHeader.startsWith("Bearer ")) return false;
  const token = authHeader.slice(7).trim();

  // Service role key starts with "eyJ" (JWT) — verify it decodes
  // with the service_role claim.
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return false;
    const payload = JSON.parse(atob(parts[1].replace(/-/g, "+").replace(/_/g, "/")));

    // Supabase service_role JWTs have role = "service_role"
    return payload.role === "service_role";
  } catch {
    return false;
  }
}

// ──────────────────────────────────────────────
// Dispatch a single schedule: call edge function
// or create an ai_job for async processing.
// ──────────────────────────────────────────────
interface TickDispatchResult {
  scheduleId: string;
  agentName: string;
  dispatchId: string | null;
  status: "dispatched" | "completed" | "failed";
  error?: string;
  durationMs: number;
}

async function dispatchSchedule(
  schedule: Record<string, unknown>,
  agent: Record<string, unknown>,
  cid: string,
): Promise<TickDispatchResult> {
  const startTime = Date.now();

  // 1. Create dispatch log entry
  const { data: dispatch, error: dispatchErr } = await supabase
    .from("agent_dispatch_log")
    .insert({
      schedule_id: schedule.id,
      agent_id: agent.id,
      brand_id: schedule.brand_id ?? null,
      lifecycle_stage_id: schedule.lifecycle_stage_id ?? null,
      action: `scheduled_${schedule.schedule_type}`,
      input_data: schedule.conditions ?? {},
      status: "dispatched",
    })
    .select("id")
    .single();

  if (dispatchErr || !dispatch) {
    structuredLog(
      "ERROR",
      "Failed to create dispatch log in tick",
      { error: dispatchErr?.message, scheduleId: schedule.id },
      cid,
    );
    return {
      scheduleId: schedule.id as string,
      agentName: (agent.name as string) ?? "unknown",
      dispatchId: null,
      status: "failed",
      error: dispatchErr?.message ?? "Failed to create dispatch log",
      durationMs: Date.now() - startTime,
    };
  }

  const dispatchId = dispatch.id;

  // Update to running
  await supabase
    .from("agent_dispatch_log")
    .update({ status: "running" })
    .eq("id", dispatchId);

  // 2. Try to call the target edge function directly
  const task = (agent.task as string) ?? "";
  const functionName = resolveEdgeFunctionName(task);

  if (functionName) {
    try {
      const functionUrl = `${supabaseUrl}/functions/v1/${functionName}`;
      const response = await fetch(functionUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${supabaseServiceRoleKey}`,
          "X-Correlation-ID": cid,
        },
        body: JSON.stringify({
          action: `scheduled_run_${schedule.schedule_type}`,
          agent_id: agent.id,
          schedule_id: schedule.id,
          brand_id: schedule.brand_id ?? null,
          ...(schedule.conditions as Record<string, unknown> ?? {}),
        }),
      });

      const durationMs = Date.now() - startTime;

      if (response.ok) {
        const responseData = await response.json() as Record<string, unknown>;

        await supabase
          .from("agent_dispatch_log")
          .update({
            status: "completed",
            output_data: responseData,
            duration_ms: durationMs,
            tokens_used: responseData.tokens_used ? Number(responseData.tokens_used) : null,
            cost_usd: responseData.cost_usd ? Number(responseData.cost_usd) : null,
          })
          .eq("id", dispatchId);

        structuredLog(
          "INFO",
          `Tick dispatch completed via ${functionName}`,
          { scheduleId: schedule.id, agentName: agent.name, durationMs },
          cid,
        );

        return {
          scheduleId: schedule.id as string,
          agentName: (agent.name as string) ?? "unknown",
          dispatchId,
          status: "completed",
          durationMs,
        };
      } else {
        const errorText = await response.text();

        await supabase
          .from("agent_dispatch_log")
          .update({
            status: "failed",
            error_message: `Edge function ${functionName} returned ${response.status}: ${errorText.slice(0, 500)}`,
            duration_ms: durationMs,
          })
          .eq("id", dispatchId);

        structuredLog(
          "ERROR",
          `Tick dispatch failed: ${functionName} returned ${response.status}`,
          { scheduleId: schedule.id, error: errorText.slice(0, 200) },
          cid,
        );

        return {
          scheduleId: schedule.id as string,
          agentName: (agent.name as string) ?? "unknown",
          dispatchId,
          status: "failed",
          error: `${functionName} returned ${response.status}`,
          durationMs,
        };
      }
    } catch (err) {
      const durationMs = Date.now() - startTime;
      const errorMsg = err instanceof Error ? err.message : "Unknown error";

      await supabase
        .from("agent_dispatch_log")
        .update({
          status: "failed",
          error_message: errorMsg,
          duration_ms: durationMs,
        })
        .eq("id", dispatchId);

      structuredLog(
        "ERROR",
        `Tick dispatch exception for schedule ${schedule.id}`,
        { error: errorMsg },
        cid,
      );

      return {
        scheduleId: schedule.id as string,
        agentName: (agent.name as string) ?? "unknown",
        dispatchId,
        status: "failed",
        error: errorMsg,
        durationMs,
      };
    }
  }

  // 3. Fallback: create an ai_job for async processing
  try {
    const { data: job, error: jobErr } = await supabase
      .from("ai_jobs")
      .insert({
        agent_id: agent.id,
        type: `scheduled_${schedule.schedule_type}`,
        payload: {
          schedule_id: schedule.id,
          brand_id: schedule.brand_id ?? null,
          ...(schedule.conditions as Record<string, unknown> ?? {}),
        },
        status: "pending",
      })
      .select("id")
      .single();

    const durationMs = Date.now() - startTime;

    if (jobErr || !job) {
      await supabase
        .from("agent_dispatch_log")
        .update({
          status: "failed",
          error_message: `Failed to create ai_job: ${jobErr?.message}`,
          duration_ms: durationMs,
        })
        .eq("id", dispatchId);

      return {
        scheduleId: schedule.id as string,
        agentName: (agent.name as string) ?? "unknown",
        dispatchId,
        status: "failed",
        error: jobErr?.message ?? "Failed to create ai_job",
        durationMs,
      };
    }

    // Link job to dispatch log
    await supabase
      .from("agent_dispatch_log")
      .update({
        job_id: job.id,
        status: "dispatched",
        output_data: { queued: true, job_id: job.id },
        duration_ms: durationMs,
      })
      .eq("id", dispatchId);

    structuredLog(
      "INFO",
      `Tick dispatch queued as ai_job`,
      { scheduleId: schedule.id, agentName: agent.name, jobId: job.id, durationMs },
      cid,
    );

    return {
      scheduleId: schedule.id as string,
      agentName: (agent.name as string) ?? "unknown",
      dispatchId,
      status: "dispatched",
      durationMs,
    };
  } catch (err) {
    const durationMs = Date.now() - startTime;
    const errorMsg = err instanceof Error ? err.message : "Unknown error";

    await supabase
      .from("agent_dispatch_log")
      .update({
        status: "failed",
        error_message: errorMsg,
        duration_ms: durationMs,
      })
      .eq("id", dispatchId);

    return {
      scheduleId: schedule.id as string,
      agentName: (agent.name as string) ?? "unknown",
      dispatchId,
      status: "failed",
      error: errorMsg,
      durationMs,
    };
  }
}

// ══════════════════════════════════════════════
// ENDPOINT: POST /agent-scheduler/tick
// ══════════════════════════════════════════════
async function handleTick(cid: string): Promise<Response> {
  structuredLog("INFO", "Agent scheduler tick: starting", {}, cid);

  // Step 1: Query all agent_schedules WHERE is_active=true AND next_run_at <= now()
  const { data: dueSchedules, error: schedErr } = await supabase
    .from("agent_schedules")
    .select(`
      id,
      agent_id,
      agent:ai_agents(id, name, task, dept, is_active),
      schedule_type,
      cron_expression,
      interval_seconds,
      event_trigger,
      lifecycle_stage_id,
      brand_id,
      conditions,
      max_retries,
      failure_count,
      run_count
    `)
    .eq("is_active", true)
    .not("next_run_at", "is", null)
    .lte("next_run_at", new Date().toISOString())
    .order("next_run_at", { ascending: true })
    .limit(MAX_DISPATCHES_PER_TICK);

  if (schedErr) {
    structuredLog(
      "ERROR",
      "Failed to query due schedules",
      { error: schedErr.message },
      cid,
    );
    return errorResponse(
      `Failed to query due schedules: ${schedErr.message}`,
      500,
      undefined,
      cid,
    );
  }

  if (!dueSchedules || dueSchedules.length === 0) {
    structuredLog("INFO", "No due schedules found", {}, cid);
    return successResponse(
      {
        success: true,
        processed: 0,
        dispatched: 0,
        failed: 0,
        deactivated: 0,
        message: "No schedules are currently due",
      },
      200,
      cid,
    );
  }

  structuredLog(
    "INFO",
    `Found ${dueSchedules.length} due schedules to process`,
    {},
    cid,
  );

  // Step 2: Process each due schedule
  let processed = 0;
  let dispatched = 0;
  let failed = 0;
  let deactivated = 0;

  const results: Array<{
    schedule_id: string;
    agent_name: string;
    status: string;
    dispatch_id: string | null;
    error?: string;
    deactivated: boolean;
  }> = [];

  for (const schedule of dueSchedules) {
    const agent = schedule.agent as
      | { id: string; name: string; task: string; dept: string; is_active: boolean }
      | null;

    processed++;

    // 2a. Validate agent
    if (!agent) {
      structuredLog(
        "WARN",
        "Schedule references non-existent agent, skipping",
        { scheduleId: schedule.id, agentId: schedule.agent_id },
        cid,
      );
      failed++;
      results.push({
        schedule_id: schedule.id as string,
        agent_name: "unknown (deleted)",
        status: "failed",
        dispatch_id: null,
        error: "Agent not found",
        deactivated: false,
      });
      continue;
    }

    if (!agent.is_active) {
      structuredLog(
        "WARN",
        "Agent is inactive, skipping schedule",
        { scheduleId: schedule.id, agentName: agent.name },
        cid,
      );
      failed++;
      results.push({
        schedule_id: schedule.id as string,
        agent_name: agent.name,
        status: "skipped",
        dispatch_id: null,
        error: "Agent is inactive",
        deactivated: false,
      });
      continue;
    }

    // 2b. Update next_run_at using update_schedule_next_run() trigger
    // This is achieved by incrementing run_count, which triggers the
    // BEFORE UPDATE trigger that auto-computes next_run_at.
    const newRunCount = ((schedule.run_count as number) ?? 0) + 1;

    const { error: updateErr } = await supabase
      .from("agent_schedules")
      .update({
        run_count: newRunCount,
        last_run_at: new Date().toISOString(),
      })
      .eq("id", schedule.id);

    if (updateErr) {
      structuredLog(
        "ERROR",
        "Failed to update schedule (run_count + last_run_at)",
        { error: updateErr.message, scheduleId: schedule.id },
        cid,
      );
      failed++;
      results.push({
        schedule_id: schedule.id as string,
        agent_name: agent.name,
        status: "failed",
        dispatch_id: null,
        error: updateErr.message,
        deactivated: false,
      });
      continue;
    }

    // 2c. Create dispatch_log entry + 2d. Call target agent's edge function or create ai_job
    const dispatchResult = await dispatchSchedule(schedule, agent, cid);

    // 2e. Handle failures
    if (dispatchResult.status === "failed") {
      const newFailureCount = ((schedule.failure_count as number) ?? 0) + 1;
      const maxRetries = (schedule.max_retries as number) ?? 3;
      const shouldDeactivate = newFailureCount >= maxRetries;

      const { error: failUpdateErr } = await supabase
        .from("agent_schedules")
        .update({
          failure_count: newFailureCount,
          is_active: !shouldDeactivate,
        })
        .eq("id", schedule.id);

      if (failUpdateErr) {
        structuredLog(
          "ERROR",
          "Failed to update failure_count on schedule",
          { error: failUpdateErr.message, scheduleId: schedule.id },
          cid,
        );
      }

      if (shouldDeactivate) {
        deactivated++;
        structuredLog(
          "WARN",
          `Schedule DEACTIVATED: exceeded max_retries (${maxRetries})`,
          {
            scheduleId: schedule.id,
            agentName: agent.name,
            failureCount: newFailureCount,
          },
          cid,
        );

        // Log the deactivation as an activity
        await supabase.from("agent_activity_log").insert({
          agent_id: agent.id,
          activity_type: "system",
          title: `Schedule auto-deactivated: ${schedule.schedule_type}`,
          description: `Exceeded max_retries (${maxRetries}). Last error: ${dispatchResult.error ?? "unknown"}`,
          metadata: {
            schedule_id: schedule.id,
            failure_count: newFailureCount,
            deactivated_by: "agent-scheduler/tick",
          },
        }).then(({ error: logErr }) => {
          if (logErr) {
            structuredLog(
              "WARN",
              "Failed to log schedule deactivation activity",
              { error: logErr.message },
              cid,
            );
          }
        });
      }

      failed++;
      results.push({
        schedule_id: schedule.id as string,
        agent_name: agent.name,
        status: dispatchResult.status,
        dispatch_id: dispatchResult.dispatchId,
        error: dispatchResult.error,
        deactivated: shouldDeactivate,
      });
    } else {
      // Success — reset failure_count to 0 on successful dispatch
      await supabase
        .from("agent_schedules")
        .update({ failure_count: 0 })
        .eq("id", schedule.id);

      dispatched++;
      results.push({
        schedule_id: schedule.id as string,
        agent_name: agent.name,
        status: dispatchResult.status,
        dispatch_id: dispatchResult.dispatchId,
        deactivated: false,
      });
    }
  }

  const tickDuration = Date.now();

  structuredLog(
    "INFO",
    `Agent scheduler tick complete`,
    {
      processed,
      dispatched,
      failed,
      deactivated,
      total_due: dueSchedules.length,
    },
    cid,
  );

  return successResponse(
    {
      success: true,
      processed,
      dispatched,
      failed,
      deactivated,
      tick_completed_at: new Date().toISOString(),
      results,
    },
    200,
    cid,
  );
}

// ──────────────────────────────────────────────
// Main Handler
// ──────────────────────────────────────────────
Deno.serve(async (req: Request) => {
  // CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  // Correlation ID
  const cid =
    req.headers.get("X-Correlation-ID") || generateCorrelationId();
  structuredLog("INFO", `Request received: ${req.method} ${req.url}`, {}, cid);

  try {
    // Verify required env secrets
    const envError = verifyEnvSecrets({
      SUPABASE_URL: supabaseUrl,
      SUPABASE_SERVICE_ROLE_KEY: supabaseServiceRoleKey,
    });
    if (envError) {
      return errorResponse(envError, 500, "Configuration error", cid);
    }

    if (req.method !== "POST") {
      return errorResponse("Method not allowed", 405, undefined, cid);
    }

    const url = new URL(req.url);

    // ── POST /agent-scheduler/tick ──
    if (url.pathname === "/agent-scheduler/tick") {
      // Step 1: Verify service_role auth
      // Cron jobs authenticate using the service_role key.
      // We also allow admin JWTs for manual testing.
      const authHeader = req.headers.get("Authorization") || "";

      const isServiceRole = isServiceRoleAuth(authHeader);
      const user = isServiceRole
        ? { userId: "service_role", role: "service_role" }
        : await verifyJWT(authHeader, supabaseUrl, supabaseAnonKey);

      if (!user) {
        structuredLog(
          "WARN",
          "Tick called without valid auth",
          {},
          cid,
        );
        return errorResponse(
          "Unauthorized: service_role key or admin JWT required",
          401,
          "Cron jobs must authenticate with the service_role key. Manual calls require an admin JWT.",
          cid,
        );
      }

      // For JWT users, verify admin role
      if (user.role !== "service_role") {
        const ADMIN_ROLES = ["admin", "Founder", "OpsHead"];
        if (!ADMIN_ROLES.includes(user.role)) {
          return errorResponse(
            "Forbidden: admin role required",
            403,
            `Your role is "${user.role}". Required: admin, Founder, or OpsHead.`,
            cid,
          );
        }
      }

      return await handleTick(cid);
    }

    return errorResponse(
      `Unknown route: ${url.pathname}`,
      404,
      undefined,
      cid,
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "Internal server error";
    return errorResponse(message, 500, undefined, cid);
  }
});