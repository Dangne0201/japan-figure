import type { Metadata } from 'next';
import ChatExperience from '../../components/chat-experience';
import SiteFooter from '../../components/site-footer';
import SiteHeader from '../../components/site-header';

export const metadata: Metadata = {
  title: 'Tư vấn figure | Japan Figure',
  description: 'Trò chuyện với trợ lý tư vấn dựa trên dữ liệu cửa hàng mô phỏng.',
};

export default function ChatPage() {
  return (
    <>
      <SiteHeader />
      <main id="main-content" tabIndex={-1} className="min-h-screen bg-brand-cream">
        <section className="page-shell py-6 sm:py-10">
          <div className="mb-5">
            <p className="text-sm font-semibold text-brand-plum">Trợ lý cửa hàng</p>
            <h1 className="mt-1 text-3xl font-semibold">Tư vấn figure</h1>
            <p className="mt-2 text-sm text-brand-ink/70">
              Câu trả lời chỉ dựa trên dữ liệu cửa hàng; nguồn tham khảo sẽ hiển thị bên dưới.
            </p>
          </div>
          <ChatExperience />
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
