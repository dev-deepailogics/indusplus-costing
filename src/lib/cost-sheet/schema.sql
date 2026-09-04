-- DDL for pre_order_cost_sheets
-- Run once manually OR let the API auto-create it on first request.

IF NOT EXISTS (
    SELECT 1 FROM INFORMATION_SCHEMA.TABLES
    WHERE TABLE_NAME = 'pre_order_cost_sheets'
)
BEGIN
    CREATE TABLE pre_order_cost_sheets (
        id                    NVARCHAR(64)   NOT NULL PRIMARY KEY,
        reference_name        NVARCHAR(256)  NOT NULL,
        style_id              NVARCHAR(64)   NOT NULL,
        style_name            NVARCHAR(256)  NOT NULL,
        customer_name         NVARCHAR(256)  NOT NULL,
        style_category        NVARCHAR(128)  NOT NULL,
        order_quantity        INT            NOT NULL DEFAULT 0,
        smv_sewing            FLOAT          NOT NULL DEFAULT 0,
        order_type            NVARCHAR(128)  NOT NULL DEFAULT '',
        wash_type             NVARCHAR(128)  NOT NULL DEFAULT '',

        -- Costing & Order Inputs
        costing_date          NVARCHAR(32)   NOT NULL DEFAULT '',
        costing_stage         NVARCHAR(64)   NOT NULL DEFAULT '',
        country               NVARCHAR(128)  NOT NULL DEFAULT '',
        payment_terms         NVARCHAR(128)  NOT NULL DEFAULT '',
        shipment_mode         NVARCHAR(128)  NOT NULL DEFAULT '',
        delivery_terms        NVARCHAR(128)  NOT NULL DEFAULT '',
        parity_sale           FLOAT          NOT NULL DEFAULT 0,
        parity_procurement    FLOAT          NOT NULL DEFAULT 0,

        -- Operational Inputs
        manpower              INT            NOT NULL DEFAULT 0,
        efficiency_override   FLOAT          NULL,
        rejection_override    FLOAT          NULL,
        line_target_override  FLOAT          NULL,

        -- Financial Parameters
        discount_rate         FLOAT          NOT NULL DEFAULT 0,
        payment_terms_days    INT            NOT NULL DEFAULT 0,
        factoring_days        INT            NOT NULL DEFAULT 0,
        commission_pct        FLOAT          NOT NULL DEFAULT 0,
        foreign_bank_charges  FLOAT          NOT NULL DEFAULT 0,
        order_fob             FLOAT          NOT NULL DEFAULT 0,
        quoted_price          FLOAT          NULL,
        intl_freight          FLOAT          NULL,
        intl_insurance        FLOAT          NULL,
        no_of_colors          INT            NULL,
        merch_group           NVARCHAR(128)  NULL,
        work_order_number     NVARCHAR(64)   NULL,
        delivery_destination  NVARCHAR(256)  NULL,
        ex_factory_date       NVARCHAR(32)   NULL,
        inhouse_or_subcontract NVARCHAR(64)  NULL,
        rebate_pct            FLOAT          NULL,

        -- BOM snapshots stored as JSON text
        bom_fabric            NVARCHAR(MAX)  NOT NULL DEFAULT '[]',
        bom_lining            NVARCHAR(MAX)  NOT NULL DEFAULT '[]',
        bom_accessories       NVARCHAR(MAX)  NOT NULL DEFAULT '[]',
        bom_chemicals         NVARCHAR(MAX)  NOT NULL DEFAULT '[]',
        bom_special_charges   NVARCHAR(MAX)  NOT NULL DEFAULT '[]',

        -- Calculated KPIs snapshot (JSON)
        calculations          NVARCHAR(MAX)  NOT NULL DEFAULT '{}',

        saved_at              NVARCHAR(64)   NOT NULL
    );

    CREATE INDEX IX_pcs_style_id ON pre_order_cost_sheets (style_id);
    CREATE INDEX IX_pcs_saved_at ON pre_order_cost_sheets (saved_at DESC);
END

-- ---------------------------------------------------------------------------
-- PARAMETER TABLES
-- ---------------------------------------------------------------------------

-- 1. Cut-to-Ship Grid
IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME='cut_to_ship_grid')
BEGIN
    CREATE TABLE cut_to_ship_grid (
        qty_band       NVARCHAR(64) NOT NULL,
        style_category NVARCHAR(64) NOT NULL,
        value          NVARCHAR(32) NOT NULL DEFAULT '',
        row_order      INT          NOT NULL DEFAULT 0,
        col_order      INT          NOT NULL DEFAULT 0,
        PRIMARY KEY (qty_band, style_category)
    );
END

-- 2. Rejection Grid
IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME='rejection_grid')
BEGIN
    CREATE TABLE rejection_grid (
        process        NVARCHAR(64) NOT NULL,
        qty_band       NVARCHAR(64) NOT NULL,
        style_category NVARCHAR(64) NOT NULL,
        value          NVARCHAR(32) NOT NULL DEFAULT '',
        process_order  INT          NOT NULL DEFAULT 0,
        row_order      INT          NOT NULL DEFAULT 0,
        col_order      INT          NOT NULL DEFAULT 0,
        PRIMARY KEY (process, qty_band, style_category)
    );
END

-- 3. Styles (Dynamic columns & values schema)
IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME='styles_columns')
BEGIN
    CREATE TABLE styles_columns (
        col_key    NVARCHAR(128) NOT NULL PRIMARY KEY,
        col_label  NVARCHAR(256) NOT NULL,
        sort_order INT           NOT NULL DEFAULT 0
    );
END

IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME='styles_values')
BEGIN
    CREATE TABLE styles_values (
        row_id    NVARCHAR(128) NOT NULL,
        col_key   NVARCHAR(128) NOT NULL,
        col_value NVARCHAR(MAX) NOT NULL DEFAULT '',
        row_order INT           NOT NULL DEFAULT 0,
        PRIMARY KEY (row_id, col_key)
    );
    CREATE INDEX IX_styles_values_order ON styles_values (row_order, row_id);
END

-- 4. Other Expenses
IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME='other_expenses')
BEGIN
    CREATE TABLE other_expenses (
        id               NVARCHAR(128) NOT NULL PRIMARY KEY,
        description      NVARCHAR(256) NOT NULL DEFAULT '',
        percent_of_sales NVARCHAR(64)  NOT NULL DEFAULT '',
        row_order        INT           NOT NULL DEFAULT 0
    );
END

-- 5. Order Types
IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME='order_types')
BEGIN
    CREATE TABLE order_types (
        id         NVARCHAR(128) NOT NULL PRIMARY KEY,
        order_type NVARCHAR(128) NOT NULL DEFAULT '',
        row_order  INT           NOT NULL DEFAULT 0
    );
END

-- 6. Customer Commissions
IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME='customer_commissions')
BEGIN
    CREATE TABLE customer_commissions (
        id                 NVARCHAR(128) NOT NULL PRIMARY KEY,
        customer           NVARCHAR(256) NOT NULL DEFAULT '',
        commission_percent NVARCHAR(64)  NOT NULL DEFAULT '',
        row_order          INT           NOT NULL DEFAULT 0
    );
END

-- 7. Cost as % of Sales
IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME='cost_as_percent_of_sales')
BEGIN
    CREATE TABLE cost_as_percent_of_sales (
        id               NVARCHAR(128) NOT NULL PRIMARY KEY,
        description      NVARCHAR(256) NOT NULL DEFAULT '',
        percent_of_sales NVARCHAR(64)  NOT NULL DEFAULT '',
        row_order        INT           NOT NULL DEFAULT 0
    );
END

-- 8. Direct Labour and FOH
IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME='direct_labour_foh')
BEGIN
    CREATE TABLE direct_labour_foh (
        id           NVARCHAR(128) NOT NULL PRIMARY KEY,
        description  NVARCHAR(256) NOT NULL DEFAULT '',
        cost_per_sam NVARCHAR(64)  NOT NULL DEFAULT '',
        row_order    INT           NOT NULL DEFAULT 0
    );
END

-- 9. Admin and Selling
IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME='admin_selling')
BEGIN
    CREATE TABLE admin_selling (
        id           NVARCHAR(128) NOT NULL PRIMARY KEY,
        description  NVARCHAR(256) NOT NULL DEFAULT '',
        cost_per_sam NVARCHAR(64)  NOT NULL DEFAULT '',
        row_order    INT           NOT NULL DEFAULT 0
    );
END

-- 10. Dropdown Lists
IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME='dropdown_lists')
BEGIN
    CREATE TABLE dropdown_lists (
        list_key   NVARCHAR(128) NOT NULL PRIMARY KEY,
        list_label NVARCHAR(256) NOT NULL,
        items_json NVARCHAR(MAX) NOT NULL DEFAULT '[]',
        sort_order INT           NOT NULL DEFAULT 0
    );
END


