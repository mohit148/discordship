import { redirect } from "next/navigation";

// The Home page was removed — Ships is now the default landing page.
export default function RootPage() {
  redirect("/ships");
}
