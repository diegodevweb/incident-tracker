import {
  proxyToBackend,
  relayBackendResponse,
  updateSessionUser,
} from "@/lib/server-api";

export async function GET() {
  return relayBackendResponse(await proxyToBackend("/account"));
}

export async function PATCH(request: Request) {
  const response = await proxyToBackend("/account", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: await request.text(),
  });

  // O nome também aparece na barra lateral, que lê o cookie da sessão.
  if (response.ok) {
    const account = (await response.clone().json()) as { name: string };
    await updateSessionUser({ name: account.name });
  }

  return relayBackendResponse(response);
}
