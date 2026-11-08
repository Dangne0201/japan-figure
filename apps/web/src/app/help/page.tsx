import type { Metadata } from 'next';
import Link from 'next/link';
import SiteFooter from '../../components/site-footer';
import SiteHeader from '../../components/site-header';

export const metadata: Metadata = {
  title: 'Hướng dẫn & câu hỏi thường gặp | Japan Figure',
  description: 'Hướng dẫn sử dụng cửa hàng mô phỏng Japan Figure và các câu hỏi thường gặp.',
};

const questions = [
  {
    question: 'Đây có phải cửa hàng bán hàng thật không?',
    answer:
      'Không. Japan Figure là dự án học tập chạy cục bộ. Đơn hàng, giá, tồn kho và các trạng thái đều phục vụ mô phỏng; website không nhận giao dịch thật.',
  },
  {
    question: 'Làm sao để thêm sản phẩm vào giỏ và đặt hàng?',
    answer:
      'Chọn sản phẩm còn hàng, chọn số lượng rồi thêm vào giỏ hoặc chọn Mua ngay. Cần đăng nhập và có địa chỉ nhận hàng để đi qua checkout. Giỏ hàng khách được gộp vào tài khoản khi đăng nhập.',
  },
  {
    question: 'Thanh toán và giao hàng có hoạt động ngoài đời không?',
    answer:
      'Không. Chuyển khoản, COD, hãng vận chuyển, phí và thời gian giao đều là mô phỏng. Không có kết nối ngân hàng, cổng thanh toán hay đơn vị vận chuyển thật.',
  },
  {
    question: 'Giá và tồn kho có được đảm bảo không?',
    answer:
      'Không. Đây là dữ liệu demo. Hệ thống sẽ kiểm tra lại tồn kho và giá khi tính báo giá; thêm sản phẩm vào giỏ không giữ tồn kho.',
  },
  {
    question: 'Sản phẩm có bảo hành hoặc xác nhận chính hãng không?',
    answer:
      'Dự án chưa triển khai chính sách bảo hành thực tế và không xác nhận nguồn gốc/chính hãng. Tên thương hiệu, mã tham khảo và ngày phát hành trong catalog không chứng minh tính xác thực.',
  },
  {
    question: 'Yêu cầu trả hàng có tạo hoàn tiền thật không?',
    answer:
      'Không. Yêu cầu trả hàng chỉ thay đổi trạng thái trong mô phỏng; website không nhận hàng và không xử lý hoàn tiền thật.',
  },
];

export default function HelpPage() {
  return (
    <>
      <SiteHeader />
      <main id="main-content" tabIndex={-1} className="min-h-screen bg-brand-cream">
        <section className="page-shell py-8 sm:py-12">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-brand-plum">
            Hỗ trợ
          </p>
          <h1 className="mt-2 text-3xl font-semibold sm:text-4xl">Hướng dẫn &amp; FAQ</h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-brand-ink/70">
            Các câu trả lời dưới đây mô tả đúng phạm vi của bản demo học tập; không thay thế tư vấn
            hoặc chính sách của cửa hàng ngoài đời.
          </p>
          <div className="mt-7 space-y-3">
            {questions.map(({ question, answer }) => (
              <details
                className="group rounded-2xl border border-brand-plum/10 bg-white p-5"
                key={question}
              >
                <summary className="cursor-pointer font-semibold marker:text-brand-plum">
                  {question}
                </summary>
                <p className="mt-3 max-w-3xl text-sm leading-6 text-brand-ink/75">{answer}</p>
              </details>
            ))}
          </div>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link className="button-primary" href="/products">
              Khám phá danh mục
            </Link>
            <Link className="button-secondary" href="/cart">
              Mở giỏ hàng
            </Link>
          </div>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
