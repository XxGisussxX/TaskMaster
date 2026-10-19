-- CreateTable
-- Grupos de permisos: cada grupo asigna un rol del workspace a sus miembros.
-- El rol efectivo se calcula como máximo(rol propio, roles de grupos) en
-- `WorkspaceAccessService`.
CREATE TABLE "PermissionGroup" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "color" TEXT NOT NULL DEFAULT '#6366f1',
    "role" "WorkspaceRole" NOT NULL DEFAULT 'MEMBER',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PermissionGroup_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PermissionGroupMember" (
    "id" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,
    "workspaceMemberId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PermissionGroupMember_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PermissionGroup_workspaceId_name_key" ON "PermissionGroup"("workspaceId", "name");

-- CreateIndex
CREATE INDEX "PermissionGroup_workspaceId_idx" ON "PermissionGroup"("workspaceId");

-- CreateIndex
CREATE UNIQUE INDEX "PermissionGroupMember_groupId_workspaceMemberId_key" ON "PermissionGroupMember"("groupId", "workspaceMemberId");

-- CreateIndex
CREATE INDEX "PermissionGroupMember_workspaceMemberId_idx" ON "PermissionGroupMember"("workspaceMemberId");

-- AddForeignKey
ALTER TABLE "PermissionGroup" ADD CONSTRAINT "PermissionGroup_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PermissionGroupMember" ADD CONSTRAINT "PermissionGroupMember_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "PermissionGroup"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PermissionGroupMember" ADD CONSTRAINT "PermissionGroupMember_workspaceMemberId_fkey" FOREIGN KEY ("workspaceMemberId") REFERENCES "WorkspaceMember"("id") ON DELETE CASCADE ON UPDATE CASCADE;
