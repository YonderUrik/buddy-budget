import { getSession } from "@/lib/auth";

export default async function DashboardPage() {
  const session = await getSession();
  const user = session?.user as any;

  return (
    <div className="container mx-auto max-w-5xl py-10">
      <h1 className="text-2xl font-semibold">Dashboard</h1>
      <p className="text-default-500 mt-2">Plan: {user.plan}</p>
    </div>
  );
}


