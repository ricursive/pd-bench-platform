import { TASK } from "@/lib/seed";
import { TaskClient } from "./TaskClient";

// Known tasks for static export.
export function generateStaticParams() {
  return [{ id: TASK.id }];
}

export default async function TaskPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <TaskClient id={id} />;
}
