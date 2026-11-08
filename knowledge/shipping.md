# Phí và thời gian giao hàng mô phỏng

## Cách tính phí

Japan Figure là mô phỏng bán hàng chạy cục bộ. Khi thanh toán, hệ thống tính phí giao hàng dựa trên khu vực tỉnh/thành trong địa chỉ nhận và tổng khối lượng các phiên bản sản phẩm trong giỏ. Khối lượng đóng gói được mô phỏng từ dữ liệu khối lượng của từng phiên bản. Hệ thống chỉ nhận kiện từ 1 g đến 30.000 g; mỗi 500 g vượt quá 1.000 g đầu tiên làm tăng một bậc phí.

Ba lựa chọn hiển thị là GHN, GHTK và Viettel Post. Mỗi mức dưới đây áp dụng cho 1.000 g đầu tiên; phụ phí tăng theo từng 500 g vượt mức đó.

| Khu vực | Lựa chọn     | Phí 1.000 g đầu | Mỗi 500 g thêm | Thời gian ước tính |
| ------- | ------------ | --------------: | -------------: | ------------------ |
| Bắc     | GHN          |        26.000 ₫ |        4.000 ₫ | 1–2 ngày           |
| Bắc     | GHTK         |        24.000 ₫ |        5.000 ₫ | 2–3 ngày           |
| Bắc     | Viettel Post |        28.000 ₫ |        4.000 ₫ | 2–3 ngày           |
| Trung   | GHN          |        32.000 ₫ |        6.000 ₫ | 2–3 ngày           |
| Trung   | GHTK         |        30.000 ₫ |        6.000 ₫ | 3–4 ngày           |
| Trung   | Viettel Post |        34.000 ₫ |        5.000 ₫ | 2–4 ngày           |
| Nam     | GHN          |        25.000 ₫ |        4.000 ₫ | 1–2 ngày           |
| Nam     | GHTK         |        23.000 ₫ |        5.000 ₫ | 2–3 ngày           |
| Nam     | Viettel Post |        27.000 ₫ |        4.000 ₫ | 2–3 ngày           |

Tỉnh/thành trong địa chỉ chọn nhóm khu vực. GHN, GHTK và Viettel Post chỉ là nhãn lựa chọn để minh họa; website không gửi yêu cầu giao hàng, dữ liệu người nhận hoặc đơn hàng tới các hãng vận chuyển.

Phí giao hàng được miễn khi tiền hàng sau giảm giá đạt ít nhất 1.500.000 ₫ hoặc khi mã miễn phí giao hàng hợp lệ được áp dụng. Mã `FREESHIP` trong dữ liệu seed có mức đơn tối thiểu 300.000 ₫. Các mức phí và thời gian dự kiến là giả lập, không phải báo giá hay cam kết giao hàng thực tế.

## Theo dõi đơn

Mã vận đơn và tiến trình chuẩn bị, giao hàng, hoàn tất được tạo bởi worker mô phỏng. Mã vận đơn này không tồn tại trên hệ thống của GHN, GHTK hoặc Viettel Post và không thể tra cứu trên website của hãng. Địa chỉ giao hàng dùng danh mục tĩnh kèm dự án; ứng dụng không tra cứu dịch vụ địa chỉ trực tuyến.
