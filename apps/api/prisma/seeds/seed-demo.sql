-- TaskMaster - seed de datos demo para "Espacio Demo"
-- Destino: workspace slug = 'espacio-demo' (login demo@taskmaster.app / password123)
-- Idempotente: elimina y vuelve a insertar SOLO filas con id prefijo 'seed_'.
-- Ejecutar:
--   $env:PGCLIENTENCODING='UTF8'
--   psql "postgresql://taskmaster:taskmaster@localhost:5432/taskmaster" -v ON_ERROR_STOP=1 -f apps/api/prisma/seeds/seed-demo.sql
BEGIN;

-- Limpieza idempotente (solo filas sembradas con prefijo seed_)
DELETE FROM "TaskTag"           WHERE "taskId" LIKE 'seed\_%' OR "tagId" LIKE 'seed\_%';
DELETE FROM "TaskAssignee"      WHERE "taskId" LIKE 'seed\_%';
DELETE FROM "NoteTag"           WHERE "noteId" LIKE 'seed\_%';
DELETE FROM "NoteCollaborator"  WHERE "noteId" LIKE 'seed\_%';
DELETE FROM "TaskDependency"    WHERE "fromTaskId" LIKE 'seed\_%' OR "toTaskId" LIKE 'seed\_%';
DELETE FROM "Comment"           WHERE "id" LIKE 'seed\_%';
DELETE FROM "ChecklistItem"     WHERE "noteId" LIKE 'seed\_%';
DELETE FROM "Reminder"          WHERE "id" LIKE 'seed\_%';
DELETE FROM "CustomFieldValue"  WHERE "id" LIKE 'seed\_%';
DELETE FROM "Notification"      WHERE "id" LIKE 'seed\_%';
DELETE FROM "TimeEntry"         WHERE "id" LIKE 'seed\_%';
DELETE FROM "Invite"            WHERE "id" LIKE 'seed\_%';
DELETE FROM "SavedView"         WHERE "id" LIKE 'seed\_%';
DELETE FROM "TaskTemplate"      WHERE "id" LIKE 'seed\_%';
DELETE FROM "Note"              WHERE "id" LIKE 'seed\_%';
DELETE FROM "Task"              WHERE "id" LIKE 'seed\_%';
DELETE FROM "WorkspaceMember"   WHERE "id" LIKE 'seed\_%';

-- 1) Miembro del equipo: Demo User como ADMIN
INSERT INTO "WorkspaceMember" ("id","workspaceId","userId","role")
VALUES (
  'seed_member_demo_local',
  (SELECT "id" FROM "Workspace" WHERE "slug" = 'espacio-demo'),
  (SELECT "id" FROM "User" WHERE "email" = 'demo@taskmaster.local'),
  'ADMIN'
);

-- 2) Tareas (10 principales + 3 subtareas); fechas relativas a NOW(): +4h/+9h/+18h caen en la ventana DUE_SOON (24h).
INSERT INTO "Task" ("id","workspaceId","creatorId","title","description","status","priority","dueDate","order","parentId","categoryId","completedAt","updatedAt") VALUES
('seed_task_demo_prep', (SELECT "id" FROM "Workspace" WHERE "slug"='espacio-demo'), (SELECT "id" FROM "User" WHERE "email"='demo@taskmaster.app'),
 'Preparar demo para el cliente', 'Armar el recorrido guiado: login, dashboard, tareas y notas. Confirmar horario con el equipo.',
 'TODO','URGENT', NOW() + interval '4 hours', 1, NULL, (SELECT "id" FROM "Category" WHERE "workspaceId"=(SELECT "id" FROM "Workspace" WHERE "slug"='espacio-demo') AND "name" LIKE 'Administrac%'), NULL, NOW()),
('seed_task_demo_docs', (SELECT "id" FROM "Workspace" WHERE "slug"='espacio-demo'), (SELECT "id" FROM "User" WHERE "email"='demo@taskmaster.app'),
 'Escribir documentacion de la API', 'Endpoints de tareas, notas, reminders y websockets. Faltan ejemplos curl y la seccion de auth.',
 'IN_PROGRESS','MEDIUM', NOW() + interval '30 hours', 2, NULL, (SELECT "id" FROM "Category" WHERE "workspaceId"=(SELECT "id" FROM "Workspace" WHERE "slug"='espacio-demo') AND "name"='Desarrollo'), NULL, NOW()),
('seed_task_demo_notes_ux', (SELECT "id" FROM "Workspace" WHERE "slug"='espacio-demo'), (SELECT "id" FROM "User" WHERE "email"='demo@taskmaster.app'),
 'Disenar pantalla de Notas', 'Explorar el combo checklist + sticky y como se ordena por pin.',
 'IN_REVIEW','HIGH', NOW() + interval '2 days', 3, NULL, (SELECT "id" FROM "Category" WHERE "workspaceId"=(SELECT "id" FROM "Workspace" WHERE "slug"='espacio-demo') AND "name" LIKE 'Dise%'), NULL, NOW()),
('seed_task_demo_facturas', (SELECT "id" FROM "Workspace" WHERE "slug"='espacio-demo'), (SELECT "id" FROM "User" WHERE "email"='demo@taskmaster.app'),
 'Revisar facturas del mes', 'Conciliar el gasto del mes y pasar pendientes a cobrar.',
 'TODO','MEDIUM', NOW() + interval '4 days', 4, NULL, (SELECT "id" FROM "Category" WHERE "workspaceId"=(SELECT "id" FROM "Workspace" WHERE "slug"='espacio-demo') AND "name" LIKE 'Administrac%'), NULL, NOW()),
('seed_task_demo_sprint', (SELECT "id" FROM "Workspace" WHERE "slug"='espacio-demo'), (SELECT "id" FROM "User" WHERE "email"='demo@taskmaster.app'),
 'Planificar sprint 6', 'Definir objetivos, metricas y responsables. Revisar el backlog primero.',
 'TODO','LOW', NOW() + interval '6 days', 5, NULL, NULL, NULL, NOW()),
('seed_task_demo_llamada', (SELECT "id" FROM "Workspace" WHERE "slug"='espacio-demo'), (SELECT "id" FROM "User" WHERE "email"='demo@taskmaster.app'),
 'Llamada de seguimiento con cliente', 'Repasar temas pendientes del ultimo corte y fijar fecha de entrega.',
 'IN_PROGRESS','HIGH', NOW() + interval '18 hours', 6, NULL, (SELECT "id" FROM "Category" WHERE "workspaceId"=(SELECT "id" FROM "Workspace" WHERE "slug"='espacio-demo') AND "name" LIKE 'Administrac%'), NULL, NOW()),
('seed_task_demo_bug', (SELECT "id" FROM "Workspace" WHERE "slug"='espacio-demo'), (SELECT "id" FROM "User" WHERE "email"='demo@taskmaster.app'),
 'Arreglar bug de login en movil', 'Reproducido con sesion expirada en Android. Revisar refresh de tokens.',
 'TODO','URGENT', NOW() + interval '9 hours', 7, NULL, (SELECT "id" FROM "Category" WHERE "workspaceId"=(SELECT "id" FROM "Workspace" WHERE "slug"='espacio-demo') AND "name"='Desarrollo'), NULL, NOW()),
('seed_task_demo_changelog', (SELECT "id" FROM "Workspace" WHERE "slug"='espacio-demo'), (SELECT "id" FROM "User" WHERE "email"='demo@taskmaster.app'),
 'Publicar changelog de la v3', 'Texto aprobado, falta merge y release.',
 'IN_REVIEW','MEDIUM', NOW() + interval '1 day', 8, NULL, (SELECT "id" FROM "Category" WHERE "workspaceId"=(SELECT "id" FROM "Workspace" WHERE "slug"='espacio-demo') AND "name" LIKE 'Administrac%'), NULL, NOW()),
('seed_task_demo_stats', (SELECT "id" FROM "Workspace" WHERE "slug"='espacio-demo'), (SELECT "id" FROM "User" WHERE "email"='demo@taskmaster.app'),
 'Refactorizar stats del dashboard', 'Mover el calculo de KPIs al paquete de domain y probarlo con casos acotados.',
 'DONE','MEDIUM', NULL, 9, NULL, (SELECT "id" FROM "Category" WHERE "workspaceId"=(SELECT "id" FROM "Workspace" WHERE "slug"='espacio-demo') AND "name"='Desarrollo'), NOW() - interval '2 days', NOW()),
('seed_task_demo_archivo', (SELECT "id" FROM "Workspace" WHERE "slug"='espacio-demo'), (SELECT "id" FROM "User" WHERE "email"='demo@taskmaster.app'),
 'Prototipo v1 (archivado)', 'Version anterior del tablero, se reemplaza por el board actual.',
 'ARCHIVED','LOW', NOW() - interval '20 days', 10, NULL, (SELECT "id" FROM "Category" WHERE "workspaceId"=(SELECT "id" FROM "Workspace" WHERE "slug"='espacio-demo') AND "name" LIKE 'Dise%'), NOW() - interval '20 days', NOW()),
('seed_task_sub_ci', (SELECT "id" FROM "Workspace" WHERE "slug"='espacio-demo'), (SELECT "id" FROM "User" WHERE "email"='demo@taskmaster.app'),
 'Configurar CI/CD', 'Pipeline de build, lint y tests con deploy en staging.',
 'IN_PROGRESS','HIGH', NULL, 1, (SELECT "id" FROM "Task" WHERE "workspaceId"=(SELECT "id" FROM "Workspace" WHERE "slug"='espacio-demo') AND "title"='Migrar TaskMaster v3' LIMIT 1), NULL, NULL, NOW()),
('seed_task_sub_e2e', (SELECT "id" FROM "Workspace" WHERE "slug"='espacio-demo'), (SELECT "id" FROM "User" WHERE "email"='demo@taskmaster.app'),
 'Escribir tests e2e', 'Cubrir el flujo completo de creacion de tarea y comentarios.',
 'TODO','HIGH', NULL, 2, (SELECT "id" FROM "Task" WHERE "workspaceId"=(SELECT "id" FROM "Workspace" WHERE "slug"='espacio-demo') AND "title"='Migrar TaskMaster v3' LIMIT 1), NULL, NULL, NOW()),
('seed_task_sub_regalo', (SELECT "id" FROM "Workspace" WHERE "slug"='espacio-demo'), (SELECT "id" FROM "User" WHERE "email"='demo@taskmaster.app'),
 'Envolver el regalo', 'Comprar el papel antes del sabado.',
 'TODO','LOW', NOW() + interval '2 days', 1, (SELECT "id" FROM "Task" WHERE "workspaceId"=(SELECT "id" FROM "Workspace" WHERE "slug"='espacio-demo') AND "title" LIKE 'Comprar el regalo%' LIMIT 1), NULL, NULL, NOW());

-- 3) Tags de tarea
INSERT INTO "TaskTag" ("taskId","tagId") VALUES
('seed_task_demo_prep', (SELECT "id" FROM "Tag" WHERE "workspaceId"=(SELECT "id" FROM "Workspace" WHERE "slug"='espacio-demo') AND "name"='Urgente')),
('seed_task_demo_docs', (SELECT "id" FROM "Tag" WHERE "workspaceId"=(SELECT "id" FROM "Workspace" WHERE "slug"='espacio-demo') AND "name"='Trabajo')),
('seed_task_demo_notes_ux', (SELECT "id" FROM "Tag" WHERE "workspaceId"=(SELECT "id" FROM "Workspace" WHERE "slug"='espacio-demo') AND "name"='Trabajo')),
('seed_task_demo_facturas', (SELECT "id" FROM "Tag" WHERE "workspaceId"=(SELECT "id" FROM "Workspace" WHERE "slug"='espacio-demo') AND "name"='Trabajo')),
('seed_task_demo_llamada', (SELECT "id" FROM "Tag" WHERE "workspaceId"=(SELECT "id" FROM "Workspace" WHERE "slug"='espacio-demo') AND "name"='Urgente')),
('seed_task_demo_bug', (SELECT "id" FROM "Tag" WHERE "workspaceId"=(SELECT "id" FROM "Workspace" WHERE "slug"='espacio-demo') AND "name"='Urgente')),
('seed_task_demo_bug', (SELECT "id" FROM "Tag" WHERE "workspaceId"=(SELECT "id" FROM "Workspace" WHERE "slug"='espacio-demo') AND "name"='Trabajo')),
('seed_task_demo_changelog', (SELECT "id" FROM "Tag" WHERE "workspaceId"=(SELECT "id" FROM "Workspace" WHERE "slug"='espacio-demo') AND "name"='Trabajo')),
('seed_task_demo_stats', (SELECT "id" FROM "Tag" WHERE "workspaceId"=(SELECT "id" FROM "Workspace" WHERE "slug"='espacio-demo') AND "name"='Trabajo'));

-- 4) Asignaciones
INSERT INTO "TaskAssignee" ("taskId","userId") VALUES
('seed_task_demo_prep', (SELECT "id" FROM "User" WHERE "email"='demo@taskmaster.app')),
('seed_task_demo_prep', (SELECT "id" FROM "User" WHERE "email"='demo@taskmaster.local')),
('seed_task_demo_docs', (SELECT "id" FROM "User" WHERE "email"='demo@taskmaster.local')),
('seed_task_demo_notes_ux', (SELECT "id" FROM "User" WHERE "email"='viewer@taskmaster.app')),
('seed_task_demo_llamada', (SELECT "id" FROM "User" WHERE "email"='demo@taskmaster.app')),
('seed_task_demo_bug', (SELECT "id" FROM "User" WHERE "email"='demo@taskmaster.app')),
('seed_task_demo_bug', (SELECT "id" FROM "User" WHERE "email"='demo@taskmaster.local')),
('seed_task_demo_changelog', (SELECT "id" FROM "User" WHERE "email"='demo@taskmaster.app'));

-- 5) Dependencias (from BLOQUEA a to)
INSERT INTO "TaskDependency" ("id","workspaceId","fromTaskId","toTaskId") VALUES
('seed_dep_bug_prep', (SELECT "id" FROM "Workspace" WHERE "slug"='espacio-demo'), 'seed_task_demo_bug', 'seed_task_demo_prep'),
('seed_dep_docs_chg', (SELECT "id" FROM "Workspace" WHERE "slug"='espacio-demo'), 'seed_task_demo_docs', 'seed_task_demo_changelog'),
('seed_dep_fac_plan', (SELECT "id" FROM "Workspace" WHERE "slug"='espacio-demo'), 'seed_task_demo_facturas', 'seed_task_demo_sprint');-- 6) Comentarios
INSERT INTO "Comment" ("id","taskId","userId","body","mentionedUserIds","createdAt") VALUES
('seed_comment_prep', 'seed_task_demo_prep', (SELECT "id" FROM "User" WHERE "email"='demo@taskmaster.app'), 'Listo el guion de la demo, manana confirmo horario con el equipo.', '[]', NOW() - interval '1 hour'),
('seed_comment_docs', 'seed_task_demo_docs', (SELECT "id" FROM "User" WHERE "email"='demo@taskmaster.app'), 'Quedan pendientes los ejemplos de curl y la seccion de auth.', '[]', NOW() - interval '6 hours'),
('seed_comment_llamada', 'seed_task_demo_llamada', (SELECT "id" FROM "User" WHERE "email"='demo@taskmaster.app'), 'Podes revisar la lista de temas antes de la llamada?', '["' || (SELECT "id" FROM "User" WHERE "email"='viewer@taskmaster.app') || '"]', NOW() - interval '3 hours'),
('seed_comment_bug', 'seed_task_demo_bug', (SELECT "id" FROM "User" WHERE "email"='demo@taskmaster.app'), 'Reproducido en Android con sesion expirada.', '[]', NOW() - interval '2 hours'),
('seed_comment_chg', 'seed_task_demo_changelog', (SELECT "id" FROM "User" WHERE "email"='demo@taskmaster.app'), 'Aprobado el texto, falta publicar.', '[]', NOW() - interval '1 day');

-- 7) Recordatorios
INSERT INTO "Reminder" ("id","workspaceId","userId","taskId","noteId","title","triggerAt","repeat") VALUES
('seed_rem_llamada', (SELECT "id" FROM "Workspace" WHERE "slug"='espacio-demo'), (SELECT "id" FROM "User" WHERE "email"='demo@taskmaster.app'),
 'seed_task_demo_llamada', NULL, 'Llamada de seguimiento con cliente', NOW() + interval '40 minutes', 'NONE'),
('seed_rem_kickoff', (SELECT "id" FROM "Workspace" WHERE "slug"='espacio-demo'), (SELECT "id" FROM "User" WHERE "email"='demo@taskmaster.app'),
 NULL, (SELECT "id" FROM "Note" WHERE "workspaceId"=(SELECT "id" FROM "Workspace" WHERE "slug"='espacio-demo') AND "title" LIKE 'Reuni%' LIMIT 1),
 'Preparar notas de la retro', NOW() + interval '2 days', 'NONE'),
('seed_rem_cobro', (SELECT "id" FROM "Workspace" WHERE "slug"='espacio-demo'), (SELECT "id" FROM "User" WHERE "email"='demo@taskmaster.app'),
 NULL, NULL, 'Cobrar factura pendiente', NOW() + interval '3 days', 'WEEKLY');

-- 8) Notificaciones (campanilla)
INSERT INTO "Notification" ("id","userId","workspaceId","type","title","body","data","readAt","createdAt") VALUES
('seed_notif_asig', (SELECT "id" FROM "User" WHERE "email"='demo@taskmaster.app'), (SELECT "id" FROM "Workspace" WHERE "slug"='espacio-demo'),
 'TASK_ASSIGNED', 'Nueva tarea asignada', 'Te asignaron: Preparar demo para el cliente', '{"taskId":"seed_task_demo_prep"}'::jsonb, NULL, NOW() - interval '8 hours'),
('seed_notif_comment', (SELECT "id" FROM "User" WHERE "email"='demo@taskmaster.app'), (SELECT "id" FROM "Workspace" WHERE "slug"='espacio-demo'),
 'COMMENT', 'Nuevo comentario', 'Demo User comento en Escribir documentacion de la API', '{"taskId":"seed_task_demo_docs"}'::jsonb, NULL, NOW() - interval '5 hours'),
('seed_notif_due', (SELECT "id" FROM "User" WHERE "email"='demo@taskmaster.app'), (SELECT "id" FROM "Workspace" WHERE "slug"='espacio-demo'),
 'DUE_SOON', 'Vence pronto', 'La tarea Preparar demo para el cliente vence en menos de 24 h', '{"taskId":"seed_task_demo_prep"}'::jsonb, NULL, NOW() - interval '1 hour'),
('seed_notif_estado', (SELECT "id" FROM "User" WHERE "email"='demo@taskmaster.app'), (SELECT "id" FROM "Workspace" WHERE "slug"='espacio-demo'),
 'STATUS_CHANGED', 'Estado actualizado', 'La tarea Publicar changelog de la v3 paso a IN_REVIEW', '{"taskId":"seed_task_demo_changelog"}'::jsonb, NULL, NOW() - interval '2 hours'),
('seed_notif_reminder', (SELECT "id" FROM "User" WHERE "email"='demo@taskmaster.app'), (SELECT "id" FROM "Workspace" WHERE "slug"='espacio-demo'),
 'REMINDER', 'Recordatorio', 'Llamada de seguimiento con cliente en unos minutos', '{"taskId":"seed_task_demo_llamada"}'::jsonb, NULL, NOW() - interval '20 minutes'),
('seed_notif_vieja', (SELECT "id" FROM "User" WHERE "email"='demo@taskmaster.app'), (SELECT "id" FROM "Workspace" WHERE "slug"='espacio-demo'),
 'TASK_ASSIGNED', 'Nueva tarea asignada', 'Te asignaron: Disenar la pagina de dashboard', '{}'::jsonb, NOW() - interval '2 days 12 hours', NOW() - interval '3 days');

-- 9) Time tracking (1 en curso que muestra el timer activo)
INSERT INTO "TimeEntry" ("id","workspaceId","taskId","userId","description","startedAt","stoppedAt","duration") VALUES
('seed_te_docs', (SELECT "id" FROM "Workspace" WHERE "slug"='espacio-demo'), 'seed_task_demo_docs', (SELECT "id" FROM "User" WHERE "email"='demo@taskmaster.local'), 'Escribir seccion de auth', NOW() - interval '2 hours 15 minutes', NOW() - interval '2 hours', 900),
('seed_te_bug', (SELECT "id" FROM "Workspace" WHERE "slug"='espacio-demo'), 'seed_task_demo_bug', (SELECT "id" FROM "User" WHERE "email"='demo@taskmaster.app'), 'Diagnostico de sesion expirada', NOW() - interval '45 minutes', NULL, NULL),
('seed_te_stats', (SELECT "id" FROM "Workspace" WHERE "slug"='espacio-demo'), 'seed_task_demo_stats', (SELECT "id" FROM "User" WHERE "email"='demo@taskmaster.app'), 'Revision de metricas del tablero', NOW() - interval '3 days', NOW() - interval '3 days 1 hour 30 minutes', 5400);-- 10) Valores de custom fields (entityType 'task')
INSERT INTO "CustomFieldValue" ("id","workspaceId","definitionId","entityId","entityType","value") VALUES
('seed_cfv_prep_venta', (SELECT "id" FROM "Workspace" WHERE "slug"='espacio-demo'), (SELECT "id" FROM "CustomFieldDefinition" WHERE "workspaceId"=(SELECT "id" FROM "Workspace" WHERE "slug"='espacio-demo') AND "name"='Prioridad venta'), 'seed_task_demo_prep', 'task', '"Alta"'::jsonb),
('seed_cfv_prep_recurrente', (SELECT "id" FROM "Workspace" WHERE "slug"='espacio-demo'), (SELECT "id" FROM "CustomFieldDefinition" WHERE "workspaceId"=(SELECT "id" FROM "Workspace" WHERE "slug"='espacio-demo') AND "name"='Es recurrente'), 'seed_task_demo_prep', 'task', 'false'::jsonb),
('seed_cfv_llamada_venta', (SELECT "id" FROM "Workspace" WHERE "slug"='espacio-demo'), (SELECT "id" FROM "CustomFieldDefinition" WHERE "workspaceId"=(SELECT "id" FROM "Workspace" WHERE "slug"='espacio-demo') AND "name"='Prioridad venta'), 'seed_task_demo_llamada', 'task', '"Alta"'::jsonb),
('seed_cfv_facturas_presu', (SELECT "id" FROM "Workspace" WHERE "slug"='espacio-demo'), (SELECT "id" FROM "CustomFieldDefinition" WHERE "workspaceId"=(SELECT "id" FROM "Workspace" WHERE "slug"='espacio-demo') AND "name"='Presupuesto'), 'seed_task_demo_facturas', 'task', '182000'::jsonb),
('seed_cfv_chg_presu', (SELECT "id" FROM "Workspace" WHERE "slug"='espacio-demo'), (SELECT "id" FROM "CustomFieldDefinition" WHERE "workspaceId"=(SELECT "id" FROM "Workspace" WHERE "slug"='espacio-demo') AND "name"='Presupuesto'), 'seed_task_demo_changelog', 'task', '25000'::jsonb),
('seed_cfv_chg_recurrente', (SELECT "id" FROM "Workspace" WHERE "slug"='espacio-demo'), (SELECT "id" FROM "CustomFieldDefinition" WHERE "workspaceId"=(SELECT "id" FROM "Workspace" WHERE "slug"='espacio-demo') AND "name"='Es recurrente'), 'seed_task_demo_changelog', 'task', 'false'::jsonb),
('seed_cfv_docs_recurrente', (SELECT "id" FROM "Workspace" WHERE "slug"='espacio-demo'), (SELECT "id" FROM "CustomFieldDefinition" WHERE "workspaceId"=(SELECT "id" FROM "Workspace" WHERE "slug"='espacio-demo') AND "name"='Es recurrente'), 'seed_task_demo_docs', 'task', 'false'::jsonb),
('seed_cfv_stats_presu', (SELECT "id" FROM "Workspace" WHERE "slug"='espacio-demo'), (SELECT "id" FROM "CustomFieldDefinition" WHERE "workspaceId"=(SELECT "id" FROM "Workspace" WHERE "slug"='espacio-demo') AND "name"='Presupuesto'), 'seed_task_demo_stats', 'task', '480000'::jsonb),
('seed_cfv_stats_recurrente', (SELECT "id" FROM "Workspace" WHERE "slug"='espacio-demo'), (SELECT "id" FROM "CustomFieldDefinition" WHERE "workspaceId"=(SELECT "id" FROM "Workspace" WHERE "slug"='espacio-demo') AND "name"='Es recurrente'), 'seed_task_demo_stats', 'task', 'true'::jsonb),
('seed_cfv_bug_presu', (SELECT "id" FROM "Workspace" WHERE "slug"='espacio-demo'), (SELECT "id" FROM "CustomFieldDefinition" WHERE "workspaceId"=(SELECT "id" FROM "Workspace" WHERE "slug"='espacio-demo') AND "name"='Presupuesto'), 'seed_task_demo_bug', 'task', '90000'::jsonb),
('seed_cfv_sprint_venta', (SELECT "id" FROM "Workspace" WHERE "slug"='espacio-demo'), (SELECT "id" FROM "CustomFieldDefinition" WHERE "workspaceId"=(SELECT "id" FROM "Workspace" WHERE "slug"='espacio-demo') AND "name"='Prioridad venta'), 'seed_task_demo_sprint', 'task', '"Baja"'::jsonb);

-- 11) Vistas guardadas (formato que consume SavedViewBar)
INSERT INTO "SavedView" ("id","workspaceId","userId","name","filters","view","updatedAt") VALUES
('seed_view_todo', (SELECT "id" FROM "Workspace" WHERE "slug"='espacio-demo'), (SELECT "id" FROM "User" WHERE "email"='demo@taskmaster.app'),
 'Por hacer', '{"status":"TODO","priority":"ALL","search":"","onlyMine":false,"onlyOverdue":false}'::jsonb, 'board', NOW()),
('seed_view_vencidas', (SELECT "id" FROM "Workspace" WHERE "slug"='espacio-demo'), (SELECT "id" FROM "User" WHERE "email"='demo@taskmaster.app'),
 'Solo vencidas', '{"status":"ALL","priority":"ALL","search":"","onlyMine":false,"onlyOverdue":true}'::jsonb, 'board', NOW());

-- 12) Plantillas de tareas
INSERT INTO "TaskTemplate" ("id","workspaceId","userId","name","description","data","updatedAt") VALUES
('seed_tpl_bug', (SELECT "id" FROM "Workspace" WHERE "slug"='espacio-demo'), (SELECT "id" FROM "User" WHERE "email"='demo@taskmaster.app'),
 'Bug de producto', 'Plantilla estandar para reportar un bug',
 '{"title":"","description":"","priority":"MEDIUM","status":"TODO","tags":[],"subtasks":[]}'::jsonb, NOW()),
('seed_tpl_sprint', (SELECT "id" FROM "Workspace" WHERE "slug"='espacio-demo'), (SELECT "id" FROM "User" WHERE "email"='demo@taskmaster.app'),
 'Tarea de sprint', 'Titulo + criterios de aceptacion para el sprint',
 '{"title":"","description":"","priority":"HIGH","status":"TODO"}'::jsonb, NOW()),
('seed_tpl_qa', (SELECT "id" FROM "Workspace" WHERE "slug"='espacio-demo'), (SELECT "id" FROM "User" WHERE "email"='demo@taskmaster.app'),
 'Subtarea de QA', 'Para dividir el QA en pasos accionables',
 '{"title":"","description":"","priority":"LOW","status":"TODO"}'::jsonb, NOW());

-- 13) Invitacion pendiente
INSERT INTO "Invite" ("id","workspaceId","email","role","token","invitedById","expiresAt","acceptedAt") VALUES
('seed_invite_nuevo', (SELECT "id" FROM "Workspace" WHERE "slug"='espacio-demo'),
 'nuevo-miembro@taskmaster.app', 'MEMBER', gen_random_uuid()::text,
 (SELECT "id" FROM "User" WHERE "email"='demo@taskmaster.app'), NOW() + interval '7 days', NULL);

-- 14) Notas (todos los tipos)
INSERT INTO "Note" ("id","workspaceId","authorId","type","title","content","color","pinned","updatedAt") VALUES
('seed_note_plata', (SELECT "id" FROM "Workspace" WHERE "slug"='espacio-demo'), (SELECT "id" FROM "User" WHERE "email"='demo@taskmaster.app'),
 'STICKY', NULL, 'Llamar a la plata por el debito duplicado.', 'PINK', false, NOW()),
('seed_note_retro', (SELECT "id" FROM "Workspace" WHERE "slug"='espacio-demo'), (SELECT "id" FROM "User" WHERE "email"='demo@taskmaster.app'),
 'MEETING', 'Retro del sprint 5', 'Hacer demo corta, rotar el facilitator y documentar las acciones en la pestana Definicion.', NULL, false, NOW()),
('seed_note_deploy', (SELECT "id" FROM "Workspace" WHERE "slug"='espacio-demo'), (SELECT "id" FROM "User" WHERE "email"='demo@taskmaster.app'),
 'CHECKLIST', 'Checklist de deploy', NULL, NULL, false, NOW()),
('seed_note_gamif', (SELECT "id" FROM "Workspace" WHERE "slug"='espacio-demo'), (SELECT "id" FROM "User" WHERE "email"='demo@taskmaster.app'),
 'IDEA', 'Gamificar completados', 'Rachas semanales y emblemas por categoria.', 'BLUE', false, NOW()),
('seed_note_backlog_mkt', (SELECT "id" FROM "Workspace" WHERE "slug"='espacio-demo'), (SELECT "id" FROM "User" WHERE "email"='demo@taskmaster.app'),
 'STANDARD', 'Backlog de marketing Q4', 'Newsletter mensual, caso de uso, y revision de pricing en noviembre.', NULL, false, NOW()),
('seed_note_backup', (SELECT "id" FROM "Workspace" WHERE "slug"='espacio-demo'), (SELECT "id" FROM "User" WHERE "email"='demo@taskmaster.app'),
 'STICKY', NULL, 'Backup de base: viernes 18:00', 'BLUE', true, NOW());

-- 15) Items del checklist
INSERT INTO "ChecklistItem" ("id","noteId","text","done","order") VALUES
('seed_ck_1', 'seed_note_deploy', 'Correr migraciones y backups', true, 0),
('seed_ck_2', 'seed_note_deploy', 'Rebuild del cliente', true, 1),
('seed_ck_3', 'seed_note_deploy', 'Actualizar changelog', false, 2),
('seed_ck_4', 'seed_note_deploy', 'Ping al canal de release', false, 3),
('seed_ck_5', 'seed_note_deploy', 'Monitorear 10 minutos', false, 4);

-- 16) Tags de notas
INSERT INTO "NoteTag" ("id","noteId","name","color") VALUES
('seed_ntag_mkt', 'seed_note_backlog_mkt', 'marketing', '#ec4899'),
('seed_ntag_cont', 'seed_note_backlog_mkt', 'contenido', '#8b5cf6');

-- 17) Colaboradores de notas
INSERT INTO "NoteCollaborator" ("noteId","userId","role") VALUES
('seed_note_retro', (SELECT "id" FROM "User" WHERE "email"='viewer@taskmaster.app'), 'EDITOR'),
('seed_note_deploy', (SELECT "id" FROM "User" WHERE "email"='viewer@taskmaster.app'), 'EDITOR');

COMMIT;