# Tài khoản, giỏ hàng và đặt đơn

## Tài khoản và địa chỉ

Người dùng tạo tài khoản để lưu hồ sơ, địa chỉ nhận hàng, đơn hàng, điểm thành viên, danh sách yêu thích và lịch sử chatbot. Website yêu cầu đăng nhập cho các thao tác thuộc tài khoản. Email xác minh và đặt lại mật khẩu của môi trường học tập được chuyển tới Mailpit cục bộ; không có email thật gửi ra ngoài.

Địa chỉ gồm tên người nhận, số điện thoại, địa chỉ đường phố, tỉnh/thành và xã/phường. Danh mục địa giới được đóng gói sẵn để ứng dụng chạy offline. Tên tỉnh/thành và xã/phường được chọn từ danh sách; phần số nhà, đường, khu phố hoặc thôn do người dùng nhập. Có thể lưu nhiều địa chỉ và chọn một địa chỉ mặc định. Đơn đã tạo lưu ảnh chụp địa chỉ tại thời điểm đặt; sửa sổ địa chỉ sau đó không viết lại địa chỉ của đơn cũ.

Chỉ nhập thông tin nhận hàng cần thiết vào biểu mẫu địa chỉ. Không gửi mật khẩu, mã xác minh hoặc thông tin nhạy cảm vào câu hỏi chatbot.

## Giỏ hàng

Giỏ hàng khách có thể được lưu tạm trên thiết bị; khi đăng nhập, các sản phẩm trong giỏ khách được hợp nhất vào giỏ tài khoản. Giỏ hàng hiển thị các mặt hàng để người dùng thay đổi số lượng hoặc xóa trước checkout. Việc thêm hàng vào giỏ không giữ tồn kho và không đảm bảo sản phẩm sẽ còn hàng sau này.

Trước khi đặt, hệ thống kiểm tra sản phẩm đã xuất bản, phiên bản được chọn và số lượng khả dụng. Nếu giá hoặc tồn kho đã thay đổi, hãy cập nhật giỏ và tính lại đơn. Không nên coi ảnh chụp hoặc nội dung cũ trong cuộc trò chuyện là báo giá hiện hành.

## Quy trình checkout

1. Đăng nhập và chọn địa chỉ nhận hàng đã lưu.
2. Nhập mã voucher nếu có, chọn số điểm muốn đổi và lựa chọn giao hàng mô phỏng.
3. Yêu cầu website tính báo giá để kiểm tra từng khoản: tiền hàng, giảm giá voucher, giá trị điểm đổi, phí giao hàng và tổng tiền.
4. Chọn một phương thức thanh toán mô phỏng rồi xác nhận tạo đơn.
5. Mở chi tiết đơn trong tài khoản để xem trạng thái và các lựa chọn tiếp theo.

Checkout tính tiền bằng số nguyên VND. Voucher được tính trên tiền hàng trước khi trừ điểm; điểm chỉ áp dụng lên phần tiền hàng còn lại và không giảm phí giao hàng. Miễn phí giao hàng được xác định từ tiền hàng sau voucher hoặc từ voucher miễn phí giao hàng hợp lệ, không phụ thuộc điểm đổi.

Số điểm dự kiến trong báo giá chỉ được cộng khi worker mô phỏng chuyển đơn sang đã giao. Điểm đổi được trừ khi tạo đơn; nếu đơn bị hủy, thất bại hoặc hết hạn trong các trạng thái được hỗ trợ, hệ thống sẽ giải phóng số điểm này. Xem trang voucher và điểm thành viên để biết điều kiện và tỷ lệ hiện tại.

## Sau khi xác nhận

Đơn hàng lưu ảnh chụp sản phẩm, giá, địa chỉ, phương thức giao hàng và tổng tiền tại thời điểm đặt. Khi tạo đơn thành công, giỏ tài khoản được xóa và lượng tồn kho tương ứng được giữ chỗ. Hàng giữ chỗ làm giảm tồn kho khả dụng công khai, nhưng chưa bị trừ khỏi số lượng trên tay cho đến khi worker mô phỏng chuyển hàng sang trạng thái đang giao.

Nếu bước xác nhận báo lỗi do giá, voucher, điểm hoặc tồn kho vừa thay đổi, hãy tải lại trang, kiểm tra nội dung giỏ hàng rồi yêu cầu báo giá mới. Không thử thanh toán bên ngoài website: dự án không có giao dịch tiền thật.
