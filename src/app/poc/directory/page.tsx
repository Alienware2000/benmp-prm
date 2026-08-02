import { redirect } from "next/navigation";

export default function DirectoryPage() {
  redirect("/poc/messages?task=update");
}
