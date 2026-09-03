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
