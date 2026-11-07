# Voucher và điểm thành viên

## Voucher demo

Mã seed `FIGURE10` giảm 10% tiền hàng, yêu cầu tiền hàng tối thiểu 500.000 ₫ và giới hạn mức giảm tối đa 200.000 ₫. Mã seed `FREESHIP` miễn phí giao hàng khi tiền hàng đạt tối thiểu 300.000 ₫. Hai mã có giới hạn lượt sử dụng, tối đa một lượt cho mỗi tài khoản và thời hạn được kiểm tra khi tạo đơn. Thời hạn seed hiện tại từ 01-01-2026 UTC đến 01-01-2027 UTC.

Voucher do quản trị viên tạo hoặc chỉnh sửa có thể có điều kiện khác. API kiểm tra tính hợp lệ và giới hạn sử dụng khi checkout; đừng giả định voucher còn hiệu lực nếu chưa được hệ thống chấp nhận.

## Điểm thành viên

Hệ thống mô phỏng tích lũy một điểm cho mỗi 10.000 ₫ tiền hàng đủ điều kiện sau voucher và điểm đổi, không tính phí giao hàng. Mỗi điểm đổi được 100 ₫. Số điểm dùng không vượt quá số dư và giá trị tiền hàng còn lại.

Điểm thưởng của đơn được cộng khi worker mô phỏng giao hàng thành công. Nếu đơn bị hủy, thất bại hoặc hết hạn ở trạng thái chờ, điểm đổi được giải phóng theo quy trình demo. Điểm không phải tiền mặt và không có giá trị quy đổi bên ngoài ứng dụng.
