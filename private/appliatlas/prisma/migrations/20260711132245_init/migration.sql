-- CreateTable
CREATE TABLE "Conflict" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "shortTitle" TEXT,
    "summary" TEXT NOT NULL,
    "startDate" DATETIME NOT NULL,
    "endDate" DATETIME,
    "isOngoing" BOOLEAN NOT NULL DEFAULT false,
    "region" TEXT NOT NULL,
    "primaryCategory" TEXT NOT NULL,
    "officialJustification" TEXT,
    "strategicContext" TEXT,
    "militaryResult" TEXT,
    "politicalResult" TEXT,
    "humanConsequences" TEXT,
    "economicConsequences" TEXT,
    "territorialConsequences" TEXT,
    "legalBasis" TEXT,
    "certaintyLevel" TEXT NOT NULL DEFAULT 'ESTABLISHED',
    "verified" BOOLEAN NOT NULL DEFAULT false,
    "needsReview" BOOLEAN NOT NULL DEFAULT true,
    "lastReviewedAt" DATETIME,
    "reviewNotes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Country" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "officialName" TEXT,
    "iso2" TEXT NOT NULL,
    "iso3" TEXT NOT NULL,
    "latitude" REAL,
    "longitude" REAL,
    "region" TEXT
);

-- CreateTable
CREATE TABLE "ConflictCountry" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "conflictId" TEXT NOT NULL,
    "countryId" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "side" TEXT,
    "description" TEXT,
    CONSTRAINT "ConflictCountry_conflictId_fkey" FOREIGN KEY ("conflictId") REFERENCES "Conflict" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ConflictCountry_countryId_fkey" FOREIGN KEY ("countryId") REFERENCES "Country" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Intervention" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "conflictId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "startDate" DATETIME,
    "endDate" DATETIME,
    "agency" TEXT,
    "isCovert" BOOLEAN NOT NULL DEFAULT false,
    "certaintyLevel" TEXT NOT NULL DEFAULT 'ESTABLISHED',
    CONSTRAINT "Intervention_conflictId_fkey" FOREIGN KEY ("conflictId") REFERENCES "Conflict" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "CasualtyEstimate" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "conflictId" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "minimumValue" INTEGER,
    "maximumValue" INTEGER,
    "bestEstimate" INTEGER,
    "unit" TEXT NOT NULL DEFAULT 'PERSONS',
    "description" TEXT,
    "needsReview" BOOLEAN NOT NULL DEFAULT false,
    "sourceId" TEXT,
    CONSTRAINT "CasualtyEstimate_conflictId_fkey" FOREIGN KEY ("conflictId") REFERENCES "Conflict" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "CasualtyEstimate_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "Source" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Territory" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "formerSovereign" TEXT NOT NULL,
    "newSovereign" TEXT NOT NULL DEFAULT 'États-Unis',
    "acquisitionDate" DATETIME,
    "areaKm2" REAL,
    "treatyName" TEXT,
    "originalPrice" REAL,
    "originalCurrency" TEXT,
    "inflationAdjustedValue" REAL,
    "description" TEXT,
    "needsReview" BOOLEAN NOT NULL DEFAULT true
);

-- CreateTable
CREATE TABLE "TerritoryState" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "territoryId" TEXT NOT NULL,
    "stateName" TEXT NOT NULL,
    "coverageType" TEXT NOT NULL,
    "estimatedShare" REAL,
    "notes" TEXT,
    CONSTRAINT "TerritoryState_territoryId_fkey" FOREIGN KEY ("territoryId") REFERENCES "Territory" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "EconomicMetric" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "territoryId" TEXT,
    "stateName" TEXT,
    "year" INTEGER NOT NULL,
    "metricType" TEXT NOT NULL,
    "value" REAL NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "isEstimate" BOOLEAN NOT NULL DEFAULT false,
    "methodology" TEXT,
    "needsReview" BOOLEAN NOT NULL DEFAULT false,
    "sourceId" TEXT,
    CONSTRAINT "EconomicMetric_territoryId_fkey" FOREIGN KEY ("territoryId") REFERENCES "Territory" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "EconomicMetric_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "Source" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Source" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL,
    "publisher" TEXT,
    "url" TEXT,
    "publicationDate" DATETIME,
    "accessedAt" DATETIME,
    "sourceType" TEXT NOT NULL,
    "reliabilityLevel" TEXT NOT NULL DEFAULT 'HIGH',
    "notes" TEXT
);

-- CreateTable
CREATE TABLE "ConflictSource" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "conflictId" TEXT NOT NULL,
    "sourceId" TEXT NOT NULL,
    "usageDescription" TEXT,
    CONSTRAINT "ConflictSource_conflictId_fkey" FOREIGN KEY ("conflictId") REFERENCES "Conflict" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ConflictSource_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "Source" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "TimelineEvent" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "conflictId" TEXT NOT NULL,
    "date" DATETIME NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "eventType" TEXT NOT NULL DEFAULT 'EVENT',
    CONSTRAINT "TimelineEvent_conflictId_fkey" FOREIGN KEY ("conflictId") REFERENCES "Conflict" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AdminNote" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "Conflict_slug_key" ON "Conflict"("slug");

-- CreateIndex
CREATE INDEX "Conflict_primaryCategory_idx" ON "Conflict"("primaryCategory");

-- CreateIndex
CREATE INDEX "Conflict_region_idx" ON "Conflict"("region");

-- CreateIndex
CREATE INDEX "Conflict_startDate_idx" ON "Conflict"("startDate");

-- CreateIndex
CREATE UNIQUE INDEX "Country_iso2_key" ON "Country"("iso2");

-- CreateIndex
CREATE UNIQUE INDEX "Country_iso3_key" ON "Country"("iso3");

-- CreateIndex
CREATE INDEX "ConflictCountry_countryId_idx" ON "ConflictCountry"("countryId");

-- CreateIndex
CREATE UNIQUE INDEX "ConflictCountry_conflictId_countryId_role_key" ON "ConflictCountry"("conflictId", "countryId", "role");

-- CreateIndex
CREATE INDEX "Intervention_conflictId_idx" ON "Intervention"("conflictId");

-- CreateIndex
CREATE INDEX "CasualtyEstimate_conflictId_idx" ON "CasualtyEstimate"("conflictId");

-- CreateIndex
CREATE UNIQUE INDEX "Territory_slug_key" ON "Territory"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "TerritoryState_territoryId_stateName_key" ON "TerritoryState"("territoryId", "stateName");

-- CreateIndex
CREATE INDEX "EconomicMetric_territoryId_idx" ON "EconomicMetric"("territoryId");

-- CreateIndex
CREATE INDEX "EconomicMetric_metricType_year_idx" ON "EconomicMetric"("metricType", "year");

-- CreateIndex
CREATE INDEX "Source_sourceType_idx" ON "Source"("sourceType");

-- CreateIndex
CREATE UNIQUE INDEX "ConflictSource_conflictId_sourceId_key" ON "ConflictSource"("conflictId", "sourceId");

-- CreateIndex
CREATE INDEX "TimelineEvent_conflictId_date_idx" ON "TimelineEvent"("conflictId", "date");

-- CreateIndex
CREATE INDEX "AdminNote_entityType_entityId_idx" ON "AdminNote"("entityType", "entityId");
