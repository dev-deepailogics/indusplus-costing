-- DDL for pre_order_cost_sheets
-- Run once manually OR let the API auto-create it on first request.
IF NOT EXISTS (SELECT 1
               FROM   INFORMATION_SCHEMA.TABLES
               WHERE  TABLE_NAME = 'pre_order_cost_sheets')
    BEGIN
        CREATE TABLE pre_order_cost_sheets (
            id                         NVARCHAR (64)  NOT NULL PRIMARY KEY,
            reference_name             NVARCHAR (256) NOT NULL,
            style_id                   NVARCHAR (64)  NOT NULL,
            style_name                 NVARCHAR (256) NOT NULL,
            customer_name              NVARCHAR (256) NOT NULL,
            style_category             NVARCHAR (128) NOT NULL,
            order_quantity             INT            DEFAULT 0 NOT NULL,
            smv_sewing                 FLOAT          DEFAULT 0 NOT NULL,
            order_type                 NVARCHAR (128) DEFAULT '' NOT NULL,
            wash_type                  NVARCHAR (128) DEFAULT '' NOT NULL,
            -- Costing & Order Inputs
            costing_date               NVARCHAR (32)  DEFAULT '' NOT NULL,
            costing_stage              NVARCHAR (64)  DEFAULT '' NOT NULL,
            country                    NVARCHAR (128) DEFAULT '' NOT NULL,
            payment_terms              NVARCHAR (128) DEFAULT '' NOT NULL,
            shipment_mode              NVARCHAR (128) DEFAULT '' NOT NULL,
            delivery_terms             NVARCHAR (128) DEFAULT '' NOT NULL,
            parity_sale                FLOAT          DEFAULT 0 NOT NULL,
            parity_procurement         FLOAT          DEFAULT 0 NOT NULL,
            -- Operational Inputs
            manpower                   INT            DEFAULT 0 NOT NULL,
            efficiency_override        FLOAT          NULL,
            rejection_override         FLOAT          NULL,
            rejection_pct              FLOAT          NULL,
            line_target_override       FLOAT          NULL,
            -- Financial Parameters
            discount_rate              FLOAT          DEFAULT 0 NOT NULL,
            payment_terms_days         INT            DEFAULT 0 NOT NULL,
            ar_term_id                 NVARCHAR (64)  NULL,
            ap_term_id                 NVARCHAR (64)  NULL,
            factoring_days             INT            DEFAULT 0 NOT NULL,
            commission_pct             FLOAT          DEFAULT 0 NOT NULL,
            foreign_bank_charges       FLOAT          DEFAULT 0 NOT NULL,
            tax_eds_pct                FLOAT          NULL,
            inland_freight_pct         FLOAT          NULL,
            local_bank_charges_pct     FLOAT          NULL,
            order_fob                  FLOAT          DEFAULT 0 NOT NULL,
            quoted_price               FLOAT          NULL,
            intl_freight               FLOAT          NULL,
            intl_insurance             FLOAT          NULL,
            no_of_colors               INT            NULL,
            merch_group                NVARCHAR (128) NULL,
            work_order_number          NVARCHAR (64)  NULL,
            delivery_destination       NVARCHAR (256) NULL,
            ex_factory_date            NVARCHAR (32)  NULL,
            inhouse_or_subcontract     NVARCHAR (64)  NULL,
            rebate_pct                 FLOAT          NULL,
            -- BOM snapshots stored as JSON text
            bom_fabric                 NVARCHAR (MAX) DEFAULT '[]' NOT NULL,
            bom_lining                 NVARCHAR (MAX) DEFAULT '[]' NOT NULL,
            bom_accessories            NVARCHAR (MAX) DEFAULT '[]' NOT NULL,
            bom_chemicals              NVARCHAR (MAX) DEFAULT '[]' NOT NULL,
            bom_special_charges        NVARCHAR (MAX) DEFAULT '[]' NOT NULL,
            -- Direct Labour & FOH parameters active card snapshot (JSON)
            direct_labour_foh_snapshot NVARCHAR (MAX) NULL,
            -- Calculated KPIs snapshot (JSON)
            calculations               NVARCHAR (MAX) DEFAULT '{}' NOT NULL,
            saved_at                   NVARCHAR (64)  NOT NULL
        );
        CREATE INDEX IX_pcs_style_id
            ON pre_order_cost_sheets(style_id);
        CREATE INDEX IX_pcs_saved_at
            ON pre_order_cost_sheets(saved_at DESC);
    END

IF NOT EXISTS (SELECT 1
               FROM   sys.columns
               WHERE  object_id = OBJECT_ID('pre_order_cost_sheets')
                      AND name = 'direct_labour_foh_snapshot')
    ALTER TABLE pre_order_cost_sheets
        ADD direct_labour_foh_snapshot NVARCHAR (MAX) NULL;

IF NOT EXISTS (SELECT 1
               FROM   sys.columns
               WHERE  object_id = OBJECT_ID('pre_order_cost_sheets')
                      AND name = 'ar_term_id')
    ALTER TABLE pre_order_cost_sheets
        ADD ar_term_id NVARCHAR (64) NULL;

IF NOT EXISTS (SELECT 1
               FROM   sys.columns
               WHERE  object_id = OBJECT_ID('pre_order_cost_sheets')
                      AND name = 'ap_term_id')
    ALTER TABLE pre_order_cost_sheets
        ADD ap_term_id NVARCHAR (64) NULL;

-- ---------------------------------------------------------------------------
-- PARAMETER TABLES
-- ---------------------------------------------------------------------------
-- 1. efficiency
IF NOT EXISTS (SELECT 1
               FROM   INFORMATION_SCHEMA.TABLES
               WHERE  TABLE_NAME = 'cut_to_ship_grid')
    BEGIN
        CREATE TABLE cut_to_ship_grid (
            qty_band       NVARCHAR (64) NOT NULL,
            style_category NVARCHAR (64) NOT NULL,
            value          NVARCHAR (32) DEFAULT '' NOT NULL,
            row_order      INT           DEFAULT 0 NOT NULL,
            col_order      INT           DEFAULT 0 NOT NULL,
            PRIMARY KEY (qty_band, style_category)
        );
    END

-- 2. Rejection Grid
IF NOT EXISTS (SELECT 1
               FROM   INFORMATION_SCHEMA.TABLES
               WHERE  TABLE_NAME = 'rejection_grid')
    BEGIN
        CREATE TABLE rejection_grid (
            process        NVARCHAR (64) NOT NULL,
            qty_band       NVARCHAR (64) NOT NULL,
            style_category NVARCHAR (64) NOT NULL,
            value          NVARCHAR (32) DEFAULT '' NOT NULL,
            process_order  INT           DEFAULT 0 NOT NULL,
            row_order      INT           DEFAULT 0 NOT NULL,
            col_order      INT           DEFAULT 0 NOT NULL,
            PRIMARY KEY (process, qty_band, style_category)
        );
    END

-- 3. Styles (Dynamic columns & values schema)
IF NOT EXISTS (SELECT 1
               FROM   INFORMATION_SCHEMA.TABLES
               WHERE  TABLE_NAME = 'styles_columns')
    BEGIN
        CREATE TABLE styles_columns (
            col_key    NVARCHAR (128) NOT NULL PRIMARY KEY,
            col_label  NVARCHAR (256) NOT NULL,
            sort_order INT            DEFAULT 0 NOT NULL
        );
    END

IF NOT EXISTS (SELECT 1
               FROM   INFORMATION_SCHEMA.TABLES
               WHERE  TABLE_NAME = 'styles_values')
    BEGIN
        CREATE TABLE styles_values (
            row_id    NVARCHAR (128) NOT NULL,
            col_key   NVARCHAR (128) NOT NULL,
            col_value NVARCHAR (MAX) DEFAULT '' NOT NULL,
            row_order INT            DEFAULT 0 NOT NULL,
            PRIMARY KEY (row_id, col_key)
        );
        CREATE INDEX IX_styles_values_order
            ON styles_values(row_order, row_id);
    END

-- 4. Other Expenses
IF NOT EXISTS (SELECT 1
               FROM   INFORMATION_SCHEMA.TABLES
               WHERE  TABLE_NAME = 'other_expenses')
    BEGIN
        CREATE TABLE other_expenses (
            id               NVARCHAR (128) NOT NULL PRIMARY KEY,
            description      NVARCHAR (256) DEFAULT '' NOT NULL,
            percent_of_sales NVARCHAR (64)  DEFAULT '' NOT NULL,
            row_order        INT            DEFAULT 0 NOT NULL
        );
    END

-- 5. Order Types
IF NOT EXISTS (SELECT 1
               FROM   INFORMATION_SCHEMA.TABLES
               WHERE  TABLE_NAME = 'order_types')
    BEGIN
        CREATE TABLE order_types (
            id         NVARCHAR (128) NOT NULL PRIMARY KEY,
            order_type NVARCHAR (128) DEFAULT '' NOT NULL,
            row_order  INT            DEFAULT 0 NOT NULL
        );
    END

-- 6. Customer Commissions
IF NOT EXISTS (SELECT 1
               FROM   INFORMATION_SCHEMA.TABLES
               WHERE  TABLE_NAME = 'customer_commissions')
    BEGIN
        CREATE TABLE customer_commissions (
            id                 NVARCHAR (128) NOT NULL PRIMARY KEY,
            customer           NVARCHAR (256) DEFAULT '' NOT NULL,
            commission_percent NVARCHAR (64)  DEFAULT '' NOT NULL,
            row_order          INT            DEFAULT 0 NOT NULL
        );
    END

-- 7. Cost as % of Sales
IF NOT EXISTS (SELECT 1
               FROM   INFORMATION_SCHEMA.TABLES
               WHERE  TABLE_NAME = 'cost_as_percent_of_sales')
    BEGIN
        CREATE TABLE cost_as_percent_of_sales (
            id               NVARCHAR (128) NOT NULL PRIMARY KEY,
            description      NVARCHAR (256) DEFAULT '' NOT NULL,
            percent_of_sales NVARCHAR (64)  DEFAULT '' NOT NULL,
            row_order        INT            DEFAULT 0 NOT NULL
        );
    END

-- 8. Direct Labour and FOH
IF NOT EXISTS (SELECT 1
               FROM   INFORMATION_SCHEMA.TABLES
               WHERE  TABLE_NAME = 'direct_labour_foh')
    BEGIN
        CREATE TABLE direct_labour_foh (
            id           NVARCHAR (128) NOT NULL,
            card_id      NVARCHAR (128) DEFAULT 'card-1' NOT NULL,
            card_name    NVARCHAR (256) DEFAULT 'Card 1' NOT NULL,
            is_active    BIT            DEFAULT 1 NOT NULL,
            card_serial  INT            DEFAULT 1 NOT NULL,
            description  NVARCHAR (256) DEFAULT '' NOT NULL,
            cost_per_sam NVARCHAR (64)  DEFAULT '' NOT NULL,
            per_piece    NVARCHAR (64)  DEFAULT '' NOT NULL,
            use_type     NVARCHAR (32)  DEFAULT 'sam' NOT NULL,
            row_order    INT            DEFAULT 0 NOT NULL
        );
    END
ELSE
    BEGIN
        IF NOT EXISTS (SELECT 1
                       FROM   sys.columns
                       WHERE  object_id = OBJECT_ID('direct_labour_foh')
                              AND name = 'per_piece')
            ALTER TABLE direct_labour_foh
                ADD per_piece NVARCHAR (64) DEFAULT '' NOT NULL;
        IF NOT EXISTS (SELECT 1
                       FROM   sys.columns
                       WHERE  object_id = OBJECT_ID('direct_labour_foh')
                              AND name = 'card_id')
            ALTER TABLE direct_labour_foh
                ADD card_id NVARCHAR (128) DEFAULT 'card-1' NOT NULL;
        IF NOT EXISTS (SELECT 1
                       FROM   sys.columns
                       WHERE  object_id = OBJECT_ID('direct_labour_foh')
                              AND name = 'card_name')
            ALTER TABLE direct_labour_foh
                ADD card_name NVARCHAR (256) DEFAULT 'Card 1' NOT NULL;
        IF NOT EXISTS (SELECT 1
                       FROM   sys.columns
                       WHERE  object_id = OBJECT_ID('direct_labour_foh')
                              AND name = 'is_active')
            ALTER TABLE direct_labour_foh
                ADD is_active BIT DEFAULT 1 NOT NULL;
        IF NOT EXISTS (SELECT 1
                       FROM   sys.columns
                       WHERE  object_id = OBJECT_ID('direct_labour_foh')
                              AND name = 'card_serial')
            ALTER TABLE direct_labour_foh
                ADD card_serial INT DEFAULT 1 NOT NULL;
        IF NOT EXISTS (SELECT 1
                       FROM   sys.columns
                       WHERE  object_id = OBJECT_ID('direct_labour_foh')
                              AND name = 'use_type')
            ALTER TABLE direct_labour_foh
                ADD use_type NVARCHAR (32) DEFAULT 'sam' NOT NULL;
    END

-- 9. Admin and Selling
IF NOT EXISTS (SELECT 1
               FROM   INFORMATION_SCHEMA.TABLES
               WHERE  TABLE_NAME = 'admin_selling')
    BEGIN
        CREATE TABLE admin_selling (
            id           NVARCHAR (128) NOT NULL PRIMARY KEY,
            description  NVARCHAR (256) DEFAULT '' NOT NULL,
            cost_per_sam NVARCHAR (64)  DEFAULT '' NOT NULL,
            row_order    INT            DEFAULT 0 NOT NULL
        );
    END

-- 10. Dropdown Lists
IF NOT EXISTS (SELECT 1
               FROM   INFORMATION_SCHEMA.TABLES
               WHERE  TABLE_NAME = 'dropdown_lists')
    BEGIN
        CREATE TABLE dropdown_lists (
            list_key   NVARCHAR (128) NOT NULL PRIMARY KEY,
            list_label NVARCHAR (256) NOT NULL,
            items_json NVARCHAR (MAX) DEFAULT '[]' NOT NULL,
            sort_order INT            DEFAULT 0 NOT NULL
        );
    END