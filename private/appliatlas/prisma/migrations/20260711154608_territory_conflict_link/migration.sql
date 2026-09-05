-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Territory" (
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
    "needsReview" BOOLEAN NOT NULL DEFAULT true,
    "conflictId" TEXT,
    CONSTRAINT "Territory_conflictId_fkey" FOREIGN KEY ("conflictId") REFERENCES "Conflict" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Territory" ("acquisitionDate", "areaKm2", "description", "formerSovereign", "id", "inflationAdjustedValue", "name", "needsReview", "newSovereign", "originalCurrency", "originalPrice", "slug", "treatyName") SELECT "acquisitionDate", "areaKm2", "description", "formerSovereign", "id", "inflationAdjustedValue", "name", "needsReview", "newSovereign", "originalCurrency", "originalPrice", "slug", "treatyName" FROM "Territory";
DROP TABLE "Territory";
ALTER TABLE "new_Territory" RENAME TO "Territory";
CREATE UNIQUE INDEX "Territory_slug_key" ON "Territory"("slug");
CREATE INDEX "Territory_conflictId_idx" ON "Territory"("conflictId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
