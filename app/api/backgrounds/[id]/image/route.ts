import { getBackgroundImageData } from "@/lib/data/backgrounds";
import { imageResponse } from "@/lib/images";

// Backgrounds are never edited (only added or removed), so the image at a
// given ID never changes and can be cached forever.
export async function GET(_req: Request, { params }: { params: { id: string } }) {
  return imageResponse(await getBackgroundImageData(params.id));
}
