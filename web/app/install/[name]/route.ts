import { getProfile, snapshotProfileNames } from "@/lib/registry";
import { bootstrapScript } from "@/lib/install";

// Serve a self-contained `curl … | bash` installer per profile, generated from
// the profile JSON. URL shape: /install/<name>.sh
export const dynamic = "force-static";

export function generateStaticParams() {
  return snapshotProfileNames().map((name) => ({ name: `${name}.sh` }));
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ name: string }> },
) {
  const { name } = await params;
  const profileName = name.replace(/\.sh$/, "");
  const profile = await getProfile(profileName);
  if (!profile) {
    return new Response(`# unknown profile: ${profileName}\n`, {
      status: 404,
      headers: { "content-type": "text/plain; charset=utf-8" },
    });
  }
  return new Response(bootstrapScript(profile), {
    headers: {
      "content-type": "text/x-shellscript; charset=utf-8",
      "cache-control": "public, max-age=300",
    },
  });
}
