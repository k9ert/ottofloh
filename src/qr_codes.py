import qrcode
import os

def create_qr(data, filename="qr_code.png", folder_path="build"):
    """
    Create a QR code from the given data and save it as a PNG file in the specified folder.

    Args:
    - data (str): The data to encode in the QR code.
    - filename (str): The name of the output file (default is "qr_code.png").
    - folder_path (str): The path to the folder where the QR code will be saved (default is current directory).
    """
    # Ensure the folder exists; if not, create it
    if not os.path.exists(folder_path):
        os.makedirs(folder_path, exist_ok=True)
    
    # Define the full path for the output file
    output_path = os.path.join(folder_path, filename)
    
    # Generate the QR code
    qr = qrcode.QRCode(
        version=1,
        error_correction=qrcode.constants.ERROR_CORRECT_L,
        box_size=20,
        border=2,
    )
    qr.add_data(data)
    qr.make(fit=True)

    img = qr.make_image(fill_color="black", back_color="white")
    
    # Save the QR code as a PNG file
    img.save(output_path)
    print(f"QR code saved as {output_path}")
    return output_path