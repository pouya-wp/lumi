-- CreateTable
CREATE TABLE "Achievement" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "earnedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Achievement_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Achievement_workspaceId_idx" ON "Achievement"("workspaceId");

-- CreateIndex
CREATE UNIQUE INDEX "Achievement_workspaceId_userId_key_key" ON "Achievement"("workspaceId", "userId", "key");
