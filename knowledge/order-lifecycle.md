# Trạng thái đơn hàng và cách theo dõi

## Trạng thái trong bản mô phỏng

Trang chi tiết đơn hiển thị lịch sử trạng thái và ghi chú của từng lần chuyển. Các trạng thái thường gặp:

- **Chờ thanh toán mô phỏng**: đơn chuyển khoản vừa được tạo và đang chờ người dùng chọn kết quả thanh toán giả lập.
- **Đã ghi nhận thanh toán mô phỏng**: người dùng đã chọn kết quả chuyển khoản thành công.
- **Đang chuẩn bị hàng mô phỏng**: đơn đã vào quy trình xử lý.
- **Đang giao hàng mô phỏng**: worker đã chuyển đơn sang bước giao và tạo mã theo dõi giả lập.
- **Đã giao hàng mô phỏng**: worker hoàn tất vòng đời demo; nếu đủ điều kiện, điểm tích lũy được cộng tại thời điểm này.
- **Thanh toán mô phỏng thất bại**, **Đã hủy đơn mô phỏng** hoặc **Đơn mô phỏng hết hạn thanh toán**: các kết quả kết thúc không thành công.
- **Đã nhận yêu cầu trả hàng mô phỏng**: hệ thống đã ghi nhận yêu cầu để quản trị viên xem xét.
- **Đã hoàn tất trả hàng mô phỏng**: quản trị viên hoàn tất trạng thái yêu cầu trong demo; không đồng nghĩa đã nhận hàng hoặc hoàn tiền thật.

Các trạng thái và thông báo chỉ mô phỏng xử lý đơn, không phải xác nhận giao dịch hoặc vận chuyển ngoài đời.

## Chuyển khoản và COD

Với chuyển khoản giả lập, đơn chờ thanh toán có thời hạn 15 phút. Trang chi tiết cho phép chọn thành công, thất bại hoặc hủy để kiểm thử vòng đời; không có ngân hàng, tài khoản nhận tiền, mã QR hoặc cổng thanh toán thật. Khi thất bại, hủy hoặc hết hạn, tồn kho giữ chỗ, voucher đã dùng và điểm đã đổi được giải phóng theo logic demo.

Với COD giả lập, đơn vào bước chuẩn bị. Worker đánh dấu thanh toán thành công khi mô phỏng hoàn tất giao hàng. Không có nhân viên giao hàng hoặc khoản tiền nào được thu.

Worker chạy nền định kỳ. Sau khi đơn được ghi nhận thanh toán, hệ thống chờ khoảng 15 giây trước khi chuyển sang chuẩn bị; bước chuẩn bị kéo dài khoảng 30 giây, bước đang giao thêm khoảng 30 giây trước khi đánh dấu đã giao. Các khoảng chờ này giúp quan sát workflow trong môi trường phát triển; chúng không phải thời gian giao hàng thực tế.

## Hủy, giữ hàng và mã theo dõi

Trong giao diện hiện tại, người mua có thể yêu cầu hủy đơn chuyển khoản khi còn chờ thanh toán hoặc đơn COD khi vẫn đang chuẩn bị. Các trạng thái sau đó không cho phép hủy theo luồng khách hàng này. Khi được hủy, hệ thống giải phóng lượng hàng đã giữ, điểm đã đổi và lượt voucher gắn với đơn.

Mã theo dõi được sinh bởi worker mô phỏng. Không thể dùng mã đó trên website GHN, GHTK hoặc Viettel Post; không có yêu cầu vận chuyển nào gửi tới các hãng. Thời gian ước tính và phí chỉ là dữ liệu học tập.

## Yêu cầu trả hàng và hóa đơn

Đơn đã giao có thể tạo yêu cầu trả hàng trong vòng bảy ngày kể từ mốc giao hàng mô phỏng. Quản trị viên có thể ghi nhận hoàn tất hoặc từ chối yêu cầu. Đây là workflow nội bộ trong database, không có thu hồi hàng, đổi sản phẩm hay hoàn tiền thật.

Chức năng in hóa đơn tạo bản xem/in cho mục đích demo. Hóa đơn này không phải chứng từ thuế hoặc xác nhận đã thanh toán ngoài đời.

Nếu trạng thái có vẻ chưa cập nhật, hãy tải lại chi tiết đơn để xem lịch sử mới nhất. Không chia sẻ số điện thoại, địa chỉ hoặc nội dung đơn của người khác qua chatbot; chatbot không thể truy vấn đơn hàng cá nhân.
