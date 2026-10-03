'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { TaskRow } from '@/components/tasks/task-row';
import { Button, Empty, Icon, Panel, Segmented, Spinner } from '@/components/ui';
import { num, useT } from '@/lib/i18n-client';
import { useMyTasks, useProjects } from '@/lib/queries';
import { useSession } from '@/lib/session';
import { useUi } from '@/lib/ui-state';

const SCOPES = ['today', 'overdue', 'upcoming', 'open', 'done'] as const;
type Scope = (typeof SCOPES)[number];

export default function MyTasksPage() {
  const { t, locale } = useT();
  const { workspace } = useSession();
  const { openQuickAdd } = useUi();
  const params = useSearchParams();
  const router = useRouter();
  const scope = (SCOPES.includes(params.get('scope') as Scope) ? params.get('scope') : 'open') as Scope;
  const tasks = useMyTasks(workspace?.id, scope);
  const projects = useProjects(workspace?.id);

  return (
    <Panel aurora="#4F5BFF" className="rise min-h-[70vh] p-5">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-semibold">{t('myTasks.title')}</h1>
        {tasks.data && <span className="rounded-full bg-sunken px-2.5 py-0.5 text-sm text-muted tabular-nums">{num(tasks.data.length, locale)}</span>}
        <div className="ms-auto flex flex-wrap items-center gap-2">
          <div className="max-w-full overflow-x-auto scrollbar-none">
            <Segmented
              value={scope}
              onChange={(s) => router.replace(`?scope=${s}`)}
              options={SCOPES.map((s) => ({ value: s, label: t(`myTasks.${s}`) }))}
            />
          </div>
          <Button variant="ink" onClick={() => openQuickAdd()}>
            <Icon name="plus" size={16} /> {t('task.new')}
          </Button>
        </div>
      </div>
      <div className="mt-5 -mx-2">
        {tasks.isLoading && <Spinner />}
        {tasks.data?.length === 0 && <Empty emoji={scope === 'done' ? '🌱' : '🎉'} text={t('dash.focusEmpty')} />}
        {tasks.data?.map((task) => (
          <TaskRow key={task.id} task={task} showProject statuses={projects.data?.find((p) => p.id === task.projectId)?.statuses} />
        ))}
      </div>
    </Panel>
  );
}
