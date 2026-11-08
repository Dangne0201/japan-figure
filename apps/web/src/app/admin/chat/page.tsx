import type { Metadata } from 'next';
import AdminChatConsole from '../../../components/admin-chat-console';
import SiteFooter from '../../../components/site-footer';
import SiteHeader from '../../../components/site-header';

export const metadata: Metadata = {
  title: 'Quản lý chatbot | Japan Figure',
};

export default function AdminChatPage() {
  return (
    <main className="min-h-screen bg-brand-cream">
      <SiteHeader />
      <AdminChatConsole />
      <SiteFooter />
    </main>
  );
}
