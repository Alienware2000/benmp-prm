import { redirect } from "next/navigation";

export default function GiftAcknowledgementTestPage() {
  redirect("/poc/messages?mode=number&template=thank-you");
}
