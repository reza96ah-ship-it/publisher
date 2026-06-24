import "./globals.css";
import { ToastProvider } from "../components/toast-provider";
import { productName, productTagline } from "../lib/product";

export const metadata = {
  title: productName,
  description: productTagline
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fa" dir="rtl">
      <body><ToastProvider>{children}</ToastProvider></body>
    </html>
  );
}
