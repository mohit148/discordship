import { getCustomAvatarData } from "@/lib/data/users";
import { imageResponse } from "@/lib/images";

// Serves someone's uploaded profile picture. The URL carries a ?v= version
// that changes on every upload, so it's safe to cache forever.
export async function GET(_req: Request, { params }: { params: { id: string } }) {
  return imageResponse(await getCustomAvatarData(params.id));
}
