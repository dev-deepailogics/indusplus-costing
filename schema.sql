-- ==============================================================================
-- INDUSPLUS COSTING - COMPLETE PRODUCTION MSSQL DATABASE SCHEMA & MIGRATIONS
-- Run this script in SQL Server Management Studio (SSMS) or Azure Data Studio.
-- All statements are idempotent (safe to run multiple times without data loss).
-- ==============================================================================

-- 1. USERS TABLE
IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'users')
BEGIN
    CREATE TABLE users (
        id                INT IDENTITY(1,1) PRIMARY KEY,
        email             NVARCHAR(255) NOT NULL UNIQUE,
        displayName       NVARCHAR(255) NOT NULL,
        passwordHash      NVARCHAR(255) NOT NULL,
        role              NVARCHAR(50)  NOT NULL DEFAULT 'merchant',
        assignedCustomer  NVARCHAR(255) NULL,
        isActive          BIT           NOT NULL DEFAULT 1,
        mustResetPassword BIT           NOT NULL DEFAULT 0,
        createdAt         DATETIME2     NOT NULL DEFAULT GETUTCDATE(),
        updatedAt         DATETIME2     NOT NULL DEFAULT GETUTCDATE()
    );
END;

IF NOT EXISTS (
    SELECT * FROM INFORMATION_SCHEMA.COLUMNS 
    WHERE TABLE_NAME = 'users' AND COLUMN_NAME = 'assignedCustomer'
)
BEGIN
    ALTER TABLE users ADD assignedCustomer NVARCHAR(255) NULL;
END;

-- 2. ROLES TABLE
IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'roles')
BEGIN
    CREATE TABLE roles (
        id          INT IDENTITY(1,1) PRIMARY KEY,
        name        NVARCHAR(100) NOT NULL UNIQUE,
        slug        NVARCHAR(100) NOT NULL UNIQUE,
        description NVARCHAR(500) NULL,
        isSystem    BIT NOT NULL DEFAULT 0,
        isActive    BIT NOT NULL DEFAULT 1,
        createdAt   DATETIME2 NOT NULL DEFAULT GETUTCDATE(),
        updatedAt   DATETIME2 NOT NULL DEFAULT GETUTCDATE()
    );
END;

-- 3. ROLE PERMISSIONS TABLE
IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'role_permissions')
BEGIN
    CREATE TABLE role_permissions (
        id          INT IDENTITY(1,1) PRIMARY KEY,
        roleId      INT NOT NULL,
        section     NVARCHAR(100) NOT NULL,
        canView     BIT NOT NULL DEFAULT 0,
        canCreate   BIT NOT NULL DEFAULT 0,
        canEdit     BIT NOT NULL DEFAULT 0,
        canDelete   BIT NOT NULL DEFAULT 0,
        canApprove  BIT NOT NULL DEFAULT 0,
        CONSTRAINT FK_role_permissions_roleId FOREIGN KEY (roleId) REFERENCES roles(id) ON DELETE CASCADE,
        CONSTRAINT UQ_role_section UNIQUE (roleId, section)
    );
END;

-- 4. TEAMS TABLE
IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'teams')
BEGIN
    CREATE TABLE teams (
        id          INT IDENTITY(1,1) PRIMARY KEY,
        name        NVARCHAR(200) NOT NULL,
        description NVARCHAR(500) NULL,
        customers   NVARCHAR(MAX) NOT NULL DEFAULT '[]',
        isActive    BIT NOT NULL DEFAULT 1,
        createdAt   DATETIME2 NOT NULL DEFAULT GETUTCDATE(),
        updatedAt   DATETIME2 NOT NULL DEFAULT GETUTCDATE()
    );
    CREATE INDEX IX_teams_isActive ON teams (isActive);
END;

IF NOT EXISTS (
    SELECT * FROM INFORMATION_SCHEMA.COLUMNS 
    WHERE TABLE_NAME = 'teams' AND COLUMN_NAME = 'customers'
)
BEGIN
    ALTER TABLE teams ADD customers NVARCHAR(MAX) NOT NULL DEFAULT '[]';
END;

-- 5. TEAM MEMBERS TABLE
IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'team_members')
BEGIN
    CREATE TABLE team_members (
        id          INT IDENTITY(1,1) PRIMARY KEY,
        teamId      INT NOT NULL,
        userId      INT NOT NULL,
        roleSlug    NVARCHAR(100) NOT NULL,
        notes       NVARCHAR(255) NULL,
        createdAt   DATETIME2 NOT NULL DEFAULT GETUTCDATE(),
        CONSTRAINT FK_team_members_teamId FOREIGN KEY (teamId) REFERENCES teams(id) ON DELETE CASCADE,
        CONSTRAINT FK_team_members_userId FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE,
        CONSTRAINT UQ_team_user_role UNIQUE (teamId, userId, roleSlug)
    );
    CREATE INDEX IX_team_members_teamId ON team_members (teamId);
    CREATE INDEX IX_team_members_userId ON team_members (userId);
END;

IF NOT EXISTS (
    SELECT * FROM INFORMATION_SCHEMA.COLUMNS 
    WHERE TABLE_NAME = 'team_members' AND COLUMN_NAME = 'createdAt'
)
BEGIN
    IF EXISTS (
        SELECT * FROM INFORMATION_SCHEMA.COLUMNS 
        WHERE TABLE_NAME = 'team_members' AND COLUMN_NAME = 'joinedAt'
    )
    BEGIN
        EXEC sp_rename 'team_members.joinedAt', 'createdAt', 'COLUMN';
    END
    ELSE
    BEGIN
        ALTER TABLE team_members ADD createdAt DATETIME2 NOT NULL DEFAULT GETUTCDATE();
    END
END;

IF NOT EXISTS (
    SELECT * FROM INFORMATION_SCHEMA.COLUMNS 
    WHERE TABLE_NAME = 'team_members' AND COLUMN_NAME = 'roleSlug'
)
BEGIN
    ALTER TABLE team_members ADD roleSlug NVARCHAR(100) NOT NULL DEFAULT '';
END;

IF NOT EXISTS (
    SELECT * FROM INFORMATION_SCHEMA.COLUMNS 
    WHERE TABLE_NAME = 'team_members' AND COLUMN_NAME = 'notes'
)
BEGIN
    ALTER TABLE team_members ADD notes NVARCHAR(255) NULL;
END;

-- 6. PRE-ORDER COST SHEETS TABLE
IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'pre_order_cost_sheets')
BEGIN
    CREATE TABLE pre_order_cost_sheets (
        id                     NVARCHAR(64)   NOT NULL PRIMARY KEY,
        reference_name         NVARCHAR(256)  NOT NULL,
        style_id               NVARCHAR(64)   NOT NULL,
        style_name             NVARCHAR(256)  NOT NULL,
        customer_name          NVARCHAR(256)  NOT NULL,
        style_category         NVARCHAR(128)  NOT NULL,
        order_quantity         INT            NOT NULL DEFAULT 0,
        smv_sewing             FLOAT          NOT NULL DEFAULT 0,
        order_type             NVARCHAR(128)  NOT NULL DEFAULT '',
        wash_type              NVARCHAR(128)  NOT NULL DEFAULT '',
        costing_date           NVARCHAR(32)   NOT NULL DEFAULT '',
        costing_stage          NVARCHAR(64)   NOT NULL DEFAULT '',
        country                NVARCHAR(128)  NOT NULL DEFAULT '',
        payment_terms          NVARCHAR(128)  NOT NULL DEFAULT '',
        shipment_mode          NVARCHAR(128)  NOT NULL DEFAULT '',
        delivery_terms         NVARCHAR(128)  NOT NULL DEFAULT '',
        parity_sale            FLOAT          NOT NULL DEFAULT 0,
        parity_procurement     FLOAT          NOT NULL DEFAULT 0,
        manpower               INT            NOT NULL DEFAULT 0,
        efficiency_override    FLOAT          NULL,
        rejection_override     FLOAT          NULL,
        rejection_pct          FLOAT          NULL,
        line_target_override   FLOAT          NULL,
        discount_rate          FLOAT          NOT NULL DEFAULT 0,
        payment_terms_days     INT            NOT NULL DEFAULT 0,
        factoring_days         INT            NOT NULL DEFAULT 0,
        commission_pct         FLOAT          NOT NULL DEFAULT 0,
        foreign_bank_charges   FLOAT          NOT NULL DEFAULT 0,
        tax_eds_pct            FLOAT          NULL,
        inland_freight_pct     FLOAT          NULL,
        local_bank_charges_pct FLOAT          NULL,
        order_fob              FLOAT          NOT NULL DEFAULT 0,
        quoted_price           FLOAT          NULL,
        intl_freight           FLOAT          NULL,
        intl_insurance         FLOAT          NULL,
        no_of_colors           INT            NULL,
        merch_group            NVARCHAR(128)  NULL,
        work_order_number      NVARCHAR(64)   NULL,
        delivery_destination   NVARCHAR(256)  NULL,
        ex_factory_date        NVARCHAR(32)   NULL,
        inhouse_or_subcontract NVARCHAR(64)   NULL,
        rebate_pct             FLOAT          NULL,
        bom_fabric             NVARCHAR(MAX)  NOT NULL DEFAULT '[]',
        bom_lining             NVARCHAR(MAX)  NOT NULL DEFAULT '[]',
        bom_accessories        NVARCHAR(MAX)  NOT NULL DEFAULT '[]',
        bom_chemicals          NVARCHAR(MAX)  NOT NULL DEFAULT '[]',
        bom_special_charges    NVARCHAR(MAX)  NOT NULL DEFAULT '[]',
        calculation_result     NVARCHAR(MAX)  NULL,
        approvals              NVARCHAR(MAX)  NULL,
        approval_status        NVARCHAR(64)   NOT NULL DEFAULT 'pending',
        created_by             NVARCHAR(256)  NOT NULL DEFAULT '',
        created_at             DATETIME2      NOT NULL DEFAULT GETUTCDATE(),
        updated_at             DATETIME2      NOT NULL DEFAULT GETUTCDATE()
    );
END;

-- 7. PARAMETER GRIDS & TABLES
IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'cut_to_ship_grid')
BEGIN
    CREATE TABLE cut_to_ship_grid (
        id INT IDENTITY(1,1) PRIMARY KEY,
        row_label NVARCHAR(64) NOT NULL,
        col_label NVARCHAR(64) NOT NULL,
        cell_value NVARCHAR(64) NOT NULL DEFAULT '',
        updated_at DATETIME2 NOT NULL DEFAULT GETUTCDATE(),
        CONSTRAINT UQ_cut_to_ship_grid UNIQUE (row_label, col_label)
    );
END;

IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'rejection_grid')
BEGIN
    CREATE TABLE rejection_grid (
        id INT IDENTITY(1,1) PRIMARY KEY,
        process_name NVARCHAR(128) NOT NULL,
        row_label NVARCHAR(64) NOT NULL,
        col_label NVARCHAR(64) NOT NULL,
        cell_value NVARCHAR(64) NOT NULL DEFAULT '',
        updated_at DATETIME2 NOT NULL DEFAULT GETUTCDATE(),
        CONSTRAINT UQ_rejection_grid UNIQUE (process_name, row_label, col_label)
    );
END;

IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'customer_rejections')
BEGIN
    CREATE TABLE customer_rejections (
        customer_name NVARCHAR(256) PRIMARY KEY,
        rate NVARCHAR(64) NOT NULL DEFAULT '0%',
        updated_at DATETIME2 NOT NULL DEFAULT GETUTCDATE()
    );
END;

IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'rejection_settings')
BEGIN
    CREATE TABLE rejection_settings (
        id INT PRIMARY KEY DEFAULT 1,
        is_grid_mode_active BIT NOT NULL DEFAULT 1,
        default_rejection_rate NVARCHAR(64) NOT NULL DEFAULT '4.15%',
        updated_at DATETIME2 NOT NULL DEFAULT GETUTCDATE()
    );
END;

IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'customer_testing_costs')
BEGIN
    CREATE TABLE customer_testing_costs (
        customer_name NVARCHAR(256) PRIMARY KEY,
        rate_per_sam FLOAT NOT NULL DEFAULT 0,
        row_order INT NOT NULL DEFAULT 0,
        updated_at DATETIME2 NOT NULL DEFAULT GETUTCDATE()
    );
END;

IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'testing_cost_settings')
BEGIN
    CREATE TABLE testing_cost_settings (
        id INT PRIMARY KEY DEFAULT 1,
        default_rate_per_sam FLOAT NOT NULL DEFAULT 0,
        updated_at DATETIME2 NOT NULL DEFAULT GETUTCDATE()
    );
END;

IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'cost_as_percent_of_sales')
BEGIN
    CREATE TABLE cost_as_percent_of_sales (
        id INT IDENTITY(1,1) PRIMARY KEY,
        card_id NVARCHAR(64) NOT NULL,
        card_title NVARCHAR(128) NOT NULL,
        is_active BIT NOT NULL DEFAULT 0,
        row_id NVARCHAR(64) NOT NULL,
        description NVARCHAR(256) NOT NULL,
        percent_of_sales NVARCHAR(64) NOT NULL DEFAULT '',
        sort_order INT NOT NULL DEFAULT 0,
        updated_at DATETIME2 NOT NULL DEFAULT GETUTCDATE()
    );
END;

IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'direct_labour_foh')
BEGIN
    CREATE TABLE direct_labour_foh (
        id INT IDENTITY(1,1) PRIMARY KEY,
        card_id NVARCHAR(64) NOT NULL,
        card_title NVARCHAR(128) NOT NULL,
        is_active BIT NOT NULL DEFAULT 0,
        row_id NVARCHAR(64) NOT NULL,
        category NVARCHAR(128) NOT NULL,
        smv NVARCHAR(64) NOT NULL DEFAULT '',
        efficiency NVARCHAR(64) NOT NULL DEFAULT '',
        cost_per_minute NVARCHAR(64) NOT NULL DEFAULT '',
        total NVARCHAR(64) NOT NULL DEFAULT '',
        sort_order INT NOT NULL DEFAULT 0,
        updated_at DATETIME2 NOT NULL DEFAULT GETUTCDATE()
    );
END;

IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'dropdown_lists')
BEGIN
    CREATE TABLE dropdown_lists (
        list_key NVARCHAR(128) PRIMARY KEY,
        label NVARCHAR(256) NOT NULL,
        items_json NVARCHAR(MAX) NOT NULL DEFAULT '[]',
        updated_at DATETIME2 NOT NULL DEFAULT GETUTCDATE()
    );
END;

-- ==============================================================================
-- 8. DEFAULT SEED DATA (USERS & ROLES)
-- ==============================================================================

-- Seed Default Admin User (admin@gmail.com / Admin@123)
IF NOT EXISTS (SELECT 1 FROM users WHERE email = 'admin@gmail.com')
BEGIN
    INSERT INTO users (email, displayName, passwordHash, role, isActive, mustResetPassword)
    VALUES (
        'admin@gmail.com',
        'Admin',
        '$2b$10$mR3GW5rCIswkJa6/KXYnu.7Wpcfnh0w5KAwEg2YESj278SdCZ6e3q',
        'admin',
        1,
        0
    );
END
ELSE
BEGIN
    UPDATE users 
    SET passwordHash = '$2b$10$mR3GW5rCIswkJa6/KXYnu.7Wpcfnh0w5KAwEg2YESj278SdCZ6e3q'
    WHERE email = 'admin@gmail.com';
END;

-- Seed Default Roles
IF NOT EXISTS (SELECT 1 FROM roles WHERE slug = 'admin')
    INSERT INTO roles (name, slug, description, isSystem, isActive) VALUES ('Admin', 'admin', 'Full access to all sections and features.', 1, 1);
IF NOT EXISTS (SELECT 1 FROM roles WHERE slug = 'merchant')
    INSERT INTO roles (name, slug, description, isSystem, isActive) VALUES ('Merchant (Costing Creator)', 'merchant', 'Creates and manages cost sheets.', 0, 1);
IF NOT EXISTS (SELECT 1 FROM roles WHERE slug = 'fabric_head')
    INSERT INTO roles (name, slug, description, isSystem, isActive) VALUES ('Fabric Head', 'fabric_head', 'Approves fabric details on cost sheets.', 0, 1);
IF NOT EXISTS (SELECT 1 FROM roles WHERE slug = 'mmc_head')
    INSERT INTO roles (name, slug, description, isSystem, isActive) VALUES ('MMC Head (Trims)', 'mmc_head', 'Approves trims and accessories on cost sheets.', 0, 1);
IF NOT EXISTS (SELECT 1 FROM roles WHERE slug = 'ie_head')
    INSERT INTO roles (name, slug, description, isSystem, isActive) VALUES ('IE Head (SAM)', 'ie_head', 'Approves IE and SAM breakdowns.', 0, 1);
IF NOT EXISTS (SELECT 1 FROM roles WHERE slug = 'washing_head')
    INSERT INTO roles (name, slug, description, isSystem, isActive) VALUES ('Washing Head', 'washing_head', 'Approves washing rates and recipes.', 0, 1);
IF NOT EXISTS (SELECT 1 FROM roles WHERE slug = 'marketing')
    INSERT INTO roles (name, slug, description, isSystem, isActive) VALUES ('Marketing', 'marketing', 'Reviews commercial FOB pricing.', 0, 1);
IF NOT EXISTS (SELECT 1 FROM roles WHERE slug = 'costing_head')
    INSERT INTO roles (name, slug, description, isSystem, isActive) VALUES ('Costing Head', 'costing_head', 'Verifies margins, overhead, and conversion.', 0, 1);
IF NOT EXISTS (SELECT 1 FROM roles WHERE slug = 'director')
    INSERT INTO roles (name, slug, description, isSystem, isActive) VALUES ('Director', 'director', 'Final authorization that locks cost sheets.', 0, 1);

-- ==============================================================================
-- 9. SEED DEFAULT ROLE PERMISSIONS
-- ==============================================================================

-- Helper CTE & Merge to populate permissions for all roles
DECLARE @AdminId INT = (SELECT id FROM roles WHERE slug = 'admin');
DECLARE @MerchantId INT = (SELECT id FROM roles WHERE slug = 'merchant');
DECLARE @FabricHeadId INT = (SELECT id FROM roles WHERE slug = 'fabric_head');
DECLARE @MmcHeadId INT = (SELECT id FROM roles WHERE slug = 'mmc_head');
DECLARE @IeHeadId INT = (SELECT id FROM roles WHERE slug = 'ie_head');
DECLARE @WashingHeadId INT = (SELECT id FROM roles WHERE slug = 'washing_head');
DECLARE @MarketingId INT = (SELECT id FROM roles WHERE slug = 'marketing');
DECLARE @CostingHeadId INT = (SELECT id FROM roles WHERE slug = 'costing_head');
DECLARE @DirectorId INT = (SELECT id FROM roles WHERE slug = 'director');

-- Seed Admin (All sections = Full access)
IF @AdminId IS NOT NULL
BEGIN
    INSERT INTO role_permissions (roleId, section, canView, canCreate, canEdit, canDelete, canApprove)
    SELECT @AdminId, s.section, 1, 1, 1, 1, 1
    FROM (VALUES 
        ('page_cost_sheets'), ('page_parameters'), ('page_users'), ('page_roles'), ('page_teams'),
        ('section_header'), ('section_fabric'), ('section_pocket_lining'), ('section_trims'),
        ('section_chemicals'), ('section_special_charges'), ('section_sam_labor'), ('section_profitability'),
        ('approval_fabric'), ('approval_mmc'), ('approval_ie'), ('approval_washing'),
        ('approval_marketing'), ('approval_costing_head'), ('approval_director')
    ) AS s(section)
    WHERE NOT EXISTS (SELECT 1 FROM role_permissions WHERE roleId = @AdminId AND section = s.section);
END;

-- Seed Merchant Permissions
IF @MerchantId IS NOT NULL
BEGIN
    INSERT INTO role_permissions (roleId, section, canView, canCreate, canEdit, canDelete, canApprove)
    SELECT @MerchantId, s.section, s.canView, s.canCreate, s.canEdit, s.canDelete, s.canApprove
    FROM (VALUES 
        ('page_cost_sheets', 1, 1, 1, 0, 0),
        ('page_parameters', 1, 0, 0, 0, 0),
        ('section_header', 1, 0, 1, 0, 0),
        ('section_fabric', 1, 0, 1, 0, 0),
        ('section_pocket_lining', 1, 0, 1, 0, 0),
        ('section_trims', 1, 0, 1, 0, 0),
        ('section_chemicals', 1, 0, 1, 0, 0),
        ('section_special_charges', 1, 0, 1, 0, 0),
        ('section_sam_labor', 1, 0, 1, 0, 0),
        ('section_profitability', 1, 0, 0, 0, 0)
    ) AS s(section, canView, canCreate, canEdit, canDelete, canApprove)
    WHERE NOT EXISTS (SELECT 1 FROM role_permissions WHERE roleId = @MerchantId AND section = s.section);
END;

-- Seed Department Head Approvals
IF @FabricHeadId IS NOT NULL
BEGIN
    INSERT INTO role_permissions (roleId, section, canView, canCreate, canEdit, canDelete, canApprove)
    SELECT @FabricHeadId, s.section, s.canView, 0, s.canEdit, 0, s.canApprove
    FROM (VALUES 
        ('page_cost_sheets', 1, 0, 0),
        ('section_fabric', 1, 1, 0),
        ('section_pocket_lining', 1, 1, 0),
        ('approval_fabric', 1, 0, 1)
    ) AS s(section, canView, canEdit, canApprove)
    WHERE NOT EXISTS (SELECT 1 FROM role_permissions WHERE roleId = @FabricHeadId AND section = s.section);
END;

IF @MmcHeadId IS NOT NULL
BEGIN
    INSERT INTO role_permissions (roleId, section, canView, canCreate, canEdit, canDelete, canApprove)
    SELECT @MmcHeadId, s.section, s.canView, 0, s.canEdit, 0, s.canApprove
    FROM (VALUES 
        ('page_cost_sheets', 1, 0, 0),
        ('section_trims', 1, 1, 0),
        ('approval_mmc', 1, 0, 1)
    ) AS s(section, canView, canEdit, canApprove)
    WHERE NOT EXISTS (SELECT 1 FROM role_permissions WHERE roleId = @MmcHeadId AND section = s.section);
END;

IF @IeHeadId IS NOT NULL
BEGIN
    INSERT INTO role_permissions (roleId, section, canView, canCreate, canEdit, canDelete, canApprove)
    SELECT @IeHeadId, s.section, s.canView, 0, s.canEdit, 0, s.canApprove
    FROM (VALUES 
        ('page_cost_sheets', 1, 0, 0),
        ('section_sam_labor', 1, 1, 0),
        ('approval_ie', 1, 0, 1)
    ) AS s(section, canView, canEdit, canApprove)
    WHERE NOT EXISTS (SELECT 1 FROM role_permissions WHERE roleId = @IeHeadId AND section = s.section);
END;

IF @WashingHeadId IS NOT NULL
BEGIN
    INSERT INTO role_permissions (roleId, section, canView, canCreate, canEdit, canDelete, canApprove)
    SELECT @WashingHeadId, s.section, s.canView, 0, s.canEdit, 0, s.canApprove
    FROM (VALUES 
        ('page_cost_sheets', 1, 0, 0),
        ('section_chemicals', 1, 1, 0),
        ('approval_washing', 1, 0, 1)
    ) AS s(section, canView, canEdit, canApprove)
    WHERE NOT EXISTS (SELECT 1 FROM role_permissions WHERE roleId = @WashingHeadId AND section = s.section);
END;

IF @MarketingId IS NOT NULL
BEGIN
    INSERT INTO role_permissions (roleId, section, canView, canCreate, canEdit, canDelete, canApprove)
    SELECT @MarketingId, s.section, s.canView, 0, s.canEdit, 0, s.canApprove
    FROM (VALUES 
        ('page_cost_sheets', 1, 0, 0),
        ('section_header', 1, 1, 0),
        ('approval_marketing', 1, 0, 1)
    ) AS s(section, canView, canEdit, canApprove)
    WHERE NOT EXISTS (SELECT 1 FROM role_permissions WHERE roleId = @MarketingId AND section = s.section);
END;

IF @CostingHeadId IS NOT NULL
BEGIN
    INSERT INTO role_permissions (roleId, section, canView, canCreate, canEdit, canDelete, canApprove)
    SELECT @CostingHeadId, s.section, s.canView, 0, s.canEdit, 0, s.canApprove
    FROM (VALUES 
        ('page_cost_sheets', 1, 0, 0),
        ('section_profitability', 1, 1, 0),
        ('approval_costing_head', 1, 0, 1)
    ) AS s(section, canView, canEdit, canApprove)
    WHERE NOT EXISTS (SELECT 1 FROM role_permissions WHERE roleId = @CostingHeadId AND section = s.section);
END;

IF @DirectorId IS NOT NULL
BEGIN
    INSERT INTO role_permissions (roleId, section, canView, canCreate, canEdit, canDelete, canApprove)
    SELECT @DirectorId, s.section, s.canView, 0, 0, 0, s.canApprove
    FROM (VALUES 
        ('page_cost_sheets', 1, 0),
        ('approval_director', 1, 1)
    ) AS s(section, canView, canApprove)
    WHERE NOT EXISTS (SELECT 1 FROM role_permissions WHERE roleId = @DirectorId AND section = s.section);
END;

PRINT 'All migrations and seeds completed successfully.';
