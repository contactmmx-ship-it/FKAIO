-- ============================================================================
-- Migration: Phase F — Accounting AI
-- Description: Bank accounts, transactions, bank statements, reconciliation,
--              and revenue snapshots for financial intelligence.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. financial_accounts — Bank accounts and financial sources
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.financial_accounts (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    account_name        TEXT NOT NULL,
    account_type        TEXT NOT NULL CHECK (account_type IN ('bank', 'cash', 'upi', 'wallet', 'other')),
    bank_name           TEXT,
    account_number_last4 TEXT,
    brand_id            UUID NOT NULL REFERENCES public.brands(id) ON DELETE CASCADE,
    is_active           BOOLEAN NOT NULL DEFAULT true,
    metadata            JSONB NOT NULL DEFAULT '{}',
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.financial_accounts ENABLE ROW LEVEL SECURITY;

-- Financial accounts: authenticated users can read
CREATE POLICY "financial_accounts_select_authenticated"
    ON public.financial_accounts
    FOR SELECT
    TO authenticated
    USING (true);

-- Financial accounts: admins can insert
CREATE POLICY "financial_accounts_insert_admin"
    ON public.financial_accounts
    FOR INSERT
    TO authenticated
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.consultants
            WHERE consultants.id = auth.uid()
              AND consultants.role IN ('Founder', 'OpsHead', 'FinanceHead', 'Admin')
        )
    );

-- Financial accounts: admins can update
CREATE POLICY "financial_accounts_update_admin"
    ON public.financial_accounts
    FOR UPDATE
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.consultants
            WHERE consultants.id = auth.uid()
              AND consultants.role IN ('Founder', 'OpsHead', 'FinanceHead', 'Admin')
        )
    );

-- Financial accounts: admins can delete
CREATE POLICY "financial_accounts_delete_admin"
    ON public.financial_accounts
    FOR DELETE
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.consultants
            WHERE consultants.id = auth.uid()
              AND consultants.role IN ('Founder', 'OpsHead', 'FinanceHead', 'Admin')
        )
    );

-- Indexes for financial_accounts
CREATE INDEX IF NOT EXISTS idx_financial_accounts_brand_id ON public.financial_accounts(brand_id);
CREATE INDEX IF NOT EXISTS idx_financial_accounts_account_type ON public.financial_accounts(account_type);
CREATE INDEX IF NOT EXISTS idx_financial_accounts_is_active ON public.financial_accounts(is_active);
CREATE INDEX IF NOT EXISTS idx_financial_accounts_bank_name ON public.financial_accounts(bank_name);

-- updated_at trigger
CREATE OR REPLACE FUNCTION public.update_financial_accounts_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_financial_accounts_updated_at
    BEFORE UPDATE ON public.financial_accounts
    FOR EACH ROW
    EXECUTE FUNCTION public.update_financial_accounts_updated_at();


-- ----------------------------------------------------------------------------
-- 2. transactions — All financial transactions
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.transactions (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    financial_account_id    UUID NOT NULL REFERENCES public.financial_accounts(id) ON DELETE CASCADE,
    transaction_date        DATE NOT NULL,
    description             TEXT NOT NULL,
    amount                  NUMERIC(12,2) NOT NULL,
    transaction_type        TEXT NOT NULL CHECK (transaction_type IN ('credit', 'debit')),
    category                TEXT CHECK (category IN ('salary', 'rent', 'marketing', 'franchise_fee', 'royalty', 'utilities', 'supplies', 'travel', 'food', 'misc')),
    reference_number        TEXT,
    invoice_id              UUID REFERENCES public.invoices(id) ON DELETE SET NULL,
    lead_id                 UUID REFERENCES public.leads(id) ON DELETE SET NULL,
    brand_id                UUID NOT NULL REFERENCES public.brands(id) ON DELETE CASCADE,
    is_reconciled           BOOLEAN NOT NULL DEFAULT false,
    reconciled_with         UUID REFERENCES public.transactions(id) ON DELETE SET NULL,
    source                  TEXT NOT NULL DEFAULT 'manual' CHECK (source IN ('manual', 'csv_import', 'bank_statement', 'ai_classified', 'auto')),
    raw_data                JSONB,
    metadata                JSONB NOT NULL DEFAULT '{}',
    created_at              TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;

-- Transactions: authenticated users can read
CREATE POLICY "transactions_select_authenticated"
    ON public.transactions
    FOR SELECT
    TO authenticated
    USING (true);

-- Transactions: admins can insert
CREATE POLICY "transactions_insert_admin"
    ON public.transactions
    FOR INSERT
    TO authenticated
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.consultants
            WHERE consultants.id = auth.uid()
              AND consultants.role IN ('Founder', 'OpsHead', 'FinanceHead', 'Admin')
        )
    );

-- Transactions: admins can update
CREATE POLICY "transactions_update_admin"
    ON public.transactions
    FOR UPDATE
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.consultants
            WHERE consultants.id = auth.uid()
              AND consultants.role IN ('Founder', 'OpsHead', 'FinanceHead', 'Admin')
        )
    );

-- Transactions: admins can delete
CREATE POLICY "transactions_delete_admin"
    ON public.transactions
    FOR DELETE
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.consultants
            WHERE consultants.id = auth.uid()
              AND consultants.role IN ('Founder', 'OpsHead', 'FinanceHead', 'Admin')
        )
    );

-- Indexes for transactions
CREATE INDEX IF NOT EXISTS idx_transactions_financial_account_id ON public.transactions(financial_account_id);
CREATE INDEX IF NOT EXISTS idx_transactions_transaction_date ON public.transactions(transaction_date);
CREATE INDEX IF NOT EXISTS idx_transactions_transaction_type ON public.transactions(transaction_type);
CREATE INDEX IF NOT EXISTS idx_transactions_category ON public.transactions(category);
CREATE INDEX IF NOT EXISTS idx_transactions_brand_id ON public.transactions(brand_id);
CREATE INDEX IF NOT EXISTS idx_transactions_is_reconciled ON public.transactions(is_reconciled);
CREATE INDEX IF NOT EXISTS idx_transactions_source ON public.transactions(source);
CREATE INDEX IF NOT EXISTS idx_transactions_invoice_id ON public.transactions(invoice_id);
CREATE INDEX IF NOT EXISTS idx_transactions_lead_id ON public.transactions(lead_id);
CREATE INDEX IF NOT EXISTS idx_transactions_reconciled_with ON public.transactions(reconciled_with);
CREATE INDEX IF NOT EXISTS idx_transactions_amount ON public.transactions(amount);

-- Composite index for duplicate detection (date + amount + description hash)
CREATE INDEX IF NOT EXISTS idx_transactions_duplicate_check
    ON public.transactions(transaction_date, amount, md5(description));

-- Composite index for reconciliation lookups
CREATE INDEX IF NOT EXISTS idx_transactions_brand_date_type
    ON public.transactions(brand_id, transaction_date, transaction_type);


-- ----------------------------------------------------------------------------
-- 3. bank_statements — Uploaded bank statements
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.bank_statements (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    financial_account_id UUID NOT NULL REFERENCES public.financial_accounts(id) ON DELETE CASCADE,
    statement_month     DATE NOT NULL,
    file_type           TEXT NOT NULL CHECK (file_type IN ('csv', 'pdf', 'xlsx')),
    storage_path        TEXT,
    row_count           INTEGER,
    imported_count      INTEGER NOT NULL DEFAULT 0,
    duplicate_count     INTEGER NOT NULL DEFAULT 0,
    status              TEXT NOT NULL DEFAULT 'uploaded' CHECK (status IN ('uploaded', 'parsed', 'importing', 'completed', 'failed')),
    error_message       TEXT,
    uploaded_by         UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.bank_statements ENABLE ROW LEVEL SECURITY;

-- Bank statements: authenticated users can read
CREATE POLICY "bank_statements_select_authenticated"
    ON public.bank_statements
    FOR SELECT
    TO authenticated
    USING (true);

-- Bank statements: admins can insert
CREATE POLICY "bank_statements_insert_admin"
    ON public.bank_statements
    FOR INSERT
    TO authenticated
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.consultants
            WHERE consultants.id = auth.uid()
              AND consultants.role IN ('Founder', 'OpsHead', 'FinanceHead', 'Admin')
        )
    );

-- Bank statements: admins can update
CREATE POLICY "bank_statements_update_admin"
    ON public.bank_statements
    FOR UPDATE
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.consultants
            WHERE consultants.id = auth.uid()
              AND consultants.role IN ('Founder', 'OpsHead', 'FinanceHead', 'Admin')
        )
    );

-- Bank statements: admins can delete
CREATE POLICY "bank_statements_delete_admin"
    ON public.bank_statements
    FOR DELETE
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.consultants
            WHERE consultants.id = auth.uid()
              AND consultants.role IN ('Founder', 'OpsHead', 'FinanceHead', 'Admin')
        )
    );

-- Indexes for bank_statements
CREATE INDEX IF NOT EXISTS idx_bank_statements_financial_account_id ON public.bank_statements(financial_account_id);
CREATE INDEX IF NOT EXISTS idx_bank_statements_statement_month ON public.bank_statements(statement_month);
CREATE INDEX IF NOT EXISTS idx_bank_statements_status ON public.bank_statements(status);
CREATE INDEX IF NOT EXISTS idx_bank_statements_uploaded_by ON public.bank_statements(uploaded_by);


-- ----------------------------------------------------------------------------
-- 4. reconciliation_rules — Rules for auto-matching transactions
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.reconciliation_rules (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name        TEXT NOT NULL,
    rule_type   TEXT NOT NULL CHECK (rule_type IN ('exact_match', 'fuzzy_match', 'ai_classify')),
    conditions  JSONB NOT NULL,
    priority    INTEGER NOT NULL DEFAULT 50,
    is_active   BOOLEAN NOT NULL DEFAULT true,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes for reconciliation_rules
CREATE INDEX IF NOT EXISTS idx_reconciliation_rules_rule_type ON public.reconciliation_rules(rule_type);
CREATE INDEX IF NOT EXISTS idx_reconciliation_rules_priority ON public.reconciliation_rules(priority DESC);
CREATE INDEX IF NOT EXISTS idx_reconciliation_rules_is_active ON public.reconciliation_rules(is_active);


-- ----------------------------------------------------------------------------
-- 5. revenue_snapshots — Monthly/quarterly/yearly revenue snapshots
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.revenue_snapshots (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    brand_id                UUID NOT NULL REFERENCES public.brands(id) ON DELETE CASCADE,
    period_start            DATE NOT NULL,
    period_end              DATE NOT NULL,
    total_revenue           NUMERIC(12,2) NOT NULL DEFAULT 0,
    total_expenses          NUMERIC(12,2) NOT NULL DEFAULT 0,
    net_profit              NUMERIC(12,2) NOT NULL DEFAULT 0,
    franchise_fees_collected NUMERIC(12,2) NOT NULL DEFAULT 0,
    royalties_collected     NUMERIC(12,2) NOT NULL DEFAULT 0,
    new_franchisees         INTEGER NOT NULL DEFAULT 0,
    active_franchisees      INTEGER NOT NULL DEFAULT 0,
    churned_franchisees     INTEGER NOT NULL DEFAULT 0,
    data                    JSONB NOT NULL DEFAULT '{}',
    snapshot_type           TEXT NOT NULL DEFAULT 'monthly' CHECK (snapshot_type IN ('monthly', 'quarterly', 'yearly')),
    created_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(brand_id, period_start, snapshot_type)
);

ALTER TABLE public.revenue_snapshots ENABLE ROW LEVEL SECURITY;

-- Revenue snapshots: authenticated users can read
CREATE POLICY "revenue_snapshots_select_authenticated"
    ON public.revenue_snapshots
    FOR SELECT
    TO authenticated
    USING (true);

-- Revenue snapshots: admins can insert
CREATE POLICY "revenue_snapshots_insert_admin"
    ON public.revenue_snapshots
    FOR INSERT
    TO authenticated
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.consultants
            WHERE consultants.id = auth.uid()
              AND consultants.role IN ('Founder', 'OpsHead', 'FinanceHead', 'Admin')
        )
    );

-- Revenue snapshots: admins can update
CREATE POLICY "revenue_snapshots_update_admin"
    ON public.revenue_snapshots
    FOR UPDATE
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.consultants
            WHERE consultants.id = auth.uid()
              AND consultants.role IN ('Founder', 'OpsHead', 'FinanceHead', 'Admin')
        )
    );

-- Revenue snapshots: admins can delete
CREATE POLICY "revenue_snapshots_delete_admin"
    ON public.revenue_snapshots
    FOR DELETE
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.consultants
            WHERE consultants.id = auth.uid()
              AND consultants.role IN ('Founder', 'OpsHead', 'FinanceHead', 'Admin')
        )
    );

-- Indexes for revenue_snapshots
CREATE INDEX IF NOT EXISTS idx_revenue_snapshots_brand_id ON public.revenue_snapshots(brand_id);
CREATE INDEX IF NOT EXISTS idx_revenue_snapshots_period_start ON public.revenue_snapshots(period_start);
CREATE INDEX IF NOT EXISTS idx_revenue_snapshots_period_end ON public.revenue_snapshots(period_end);
CREATE INDEX IF NOT EXISTS idx_revenue_snapshots_snapshot_type ON public.revenue_snapshots(snapshot_type);