# Tài khoản, quyền riêng tư và tư vấn chatbot

## Dữ liệu tài khoản

Địa chỉ, lịch sử đơn, danh sách yêu thích và hội thoại chatbot thuộc tài khoản đã đăng nhập. Tài khoản chỉ xem các hội thoại của chính mình; việc gửi câu hỏi không cấp cho chatbot quyền đọc đơn hàng, địa chỉ nhận hàng, phương thức thanh toán hoặc dữ liệu riêng tư của khách khác.

Chatbot trả lời dựa trên tài liệu Markdown cục bộ của cửa hàng và thông tin công khai của sản phẩm đang xuất bản. Chatbot không tìm kiếm web, không liên hệ hãng vận chuyển hoặc cổng thanh toán, và không thực hiện thay đổi tài khoản/đơn hàng. Nếu tài liệu hoặc catalog không có câu trả lời phù hợp, chatbot nên nói rõ chưa có thông tin thay vì suy đoán.

Các câu hỏi và câu trả lời được lưu trong lịch sử hội thoại của tài khoản để người dùng mở lại, đánh giá hoặc xóa hội thoại. Nội dung hội thoại cũng có thể được nhân viên quản trị có quyền xem trong công cụ kiểm tra chất lượng; do đó không nhập mật khẩu, mã OTP, thông tin thẻ, địa chỉ nhà hoặc dữ liệu nhạy cảm vào chat.

## Xác minh và hỗ trợ đăng nhập

Tài khoản cần hoàn tất xác minh email để dùng các chức năng chat được bảo vệ. Trong bản demo, thư xác minh và đặt lại mật khẩu chỉ được gửi tới Mailpit trên máy chủ cục bộ; đây không phải dịch vụ email thật. Nếu không nhận được thư trong bài tập local, người vận hành có thể kiểm tra hộp thư Mailpit tại `http://localhost:8025`.

Người dùng có thể dùng trang quên mật khẩu để yêu cầu liên kết đặt lại. Không chia sẻ liên kết một lần hoặc token trong chat. Nếu tài khoản bị vô hiệu hóa bởi quản trị viên, hãy liên hệ chủ dự án trong phạm vi môi trường học tập; website không công bố kênh chăm sóc khách hàng ngoài đời.

## Cách trả lời các yêu cầu riêng tư

Khi được hỏi về đơn hàng, địa chỉ, tài khoản hoặc lịch sử của một người cụ thể, hãy giải thích rằng chatbot không thể tra cứu thông tin cá nhân. Hướng dẫn chủ tài khoản đăng nhập và mở khu vực đơn hàng/tài khoản của họ. Không yêu cầu người dùng gửi email, mật khẩu, mã xác minh hoặc địa chỉ vào chat để tra hộ.

Nếu người dùng hỏi về dữ liệu của người khác, từ chối lịch sự và không xác nhận liệu bản ghi đó có tồn tại hay không. Chỉ sử dụng nguồn tài liệu hoặc sản phẩm công khai đã được hệ thống cung cấp cho câu hỏi hiện tại.
