import io
import os
import requests
from config import read_api_key_from_yaml
from reportlab.lib.pagesizes import A4
from reportlab.pdfgen import canvas
from PIL import Image
from kmzparser import parse_kml_coordinates, parse_kml_addresses

from qr_codes import create_qr

def generate_map_image(center, zoom, api_key, locations_with_styles):
    marker_style = "color:red|size:tiny"
    marker_locations = "|".join([f"{lat},{lon}" for lat, lon, _ in coordinates])
    
    map_url = f"https://maps.googleapis.com/maps/api/staticmap?size={image_width}x{image_height}&scale=2&markers={marker_style}|{marker_locations}&key={api_key}"
    response = requests.get(map_url)
    if response.status_code == 200:
        image = Image.open(io.BytesIO(response.content))
        # Crop parameters: left, top, right, bottom
        # Crop the image to desired dimensions, for example, cropping 50 pixels from each side
        # Adjust these numbers based on how you want to crop the image
        left = 150
        top = 100
        right = image_width * 2 - 150
        bottom = image_height * 2 - 70
        image = image.crop((left, top, right, bottom))
        image.save('build/map.png')
        print("Map image saved. ")
    else:
        print("Failed to retrieve the map image.")
    return 'build/map.png'

def write_address_list(c, start_x=70, start_y=380, column_width=165, max_lines_per_column=21):
    y = start_y
    x = start_x
    line_height = 14
    for i, address in enumerate(sorted(addresses)):
        # Determine if we need to move to the next column
        if i % max_lines_per_column == 0 and i != 0:
            x += column_width  # Move to next column after every 'max_lines_per_column' addresses
            y = start_y  # Reset Y to top of the current column
        
        # Check if we've filled three columns, and start a new page if so
        if x > start_x + (2 * column_width):  # Adjust based on number of columns
            # Add current page and start a new one
            c.showPage()
            # Reset positions for new page
            x = start_x
            y = start_y
            # No need to drawImage again unless you want the map on every page
        
        text = f'{i + 1:02}. {address}'
        if address == "Hirtenstraße 17":
            c.setFont("Helvetica-Bold", 10)
        c.drawString(x, y, text)
        c.setFont("Helvetica", 10)
        y -= line_height  # Move down for next address


def create_pdf(title, short_link, map_image_path, addresses):
    output_pdf_path=f"build/{title}.pdf"
    c = canvas.Canvas(output_pdf_path, pagesize=A4)  # A4 is 595.27 x 841.89 points
    
    # Set font to Helvetica-Bold (a standard font) and size to 18 for the title
    c.setFont("Helvetica-Bold", 28)
    
    # Draw the title text
    # The positioning (here 100, 800) may need adjustment depending on your layout
    c.drawString(90, 770, title)
    c.setFont("Helvetica-Bold", 10)
    #subtitle
    c.drawString(90, 750, "Samstag, 24. Mai 2025, 10:00 - 14:00 Uhr")
    c.setFont("Helvetica", 10)
    c.drawString(90, 730, "Eine Benefizveranstaltung zugunsten des CRP-Bangladesch")
    c.drawString(90, 710, "www.crp-bangladesh.org")
    create_qr("https://bit.ly/4bTcu4W", filename="crp_qr.png")
    c.drawImage("build/crp_qr.png", 450,700, width=70, height=70)
    


    # Place map image on the upper half
    c.drawImage(map_image_path, 90, 430, width=image_width*0.6, height=image_height*0.6)  # Adjust dimensions as needed

    # Place short_link below the map
    c.drawString(300, 410, f"{short_link}")
    # Place QR-Code right next to the map
    create_qr(short_link, filename="bitly_qr.png")
    c.drawImage("build/bitly_qr.png", 370, 400, width=170, height=170)
    
    write_address_list(c,start_y=390, max_lines_per_column=23)

    c.showPage()
    c.save()
    print(f"PDF created successfully at {output_pdf_path}.")


os.makedirs("build", exist_ok=True)



image_height = 440
image_width = 640

short_link = "bit.ly/4j3T2Xh"
title = "Ottobrunner Hofflohmarkt 2025"
kmz_file="data.kmz"
coordinates = parse_kml_coordinates()
addresses = parse_kml_addresses()
api_key = read_api_key_from_yaml("api_key")
center = '48.06388, 11.6681'  # Choose an appropriate map center
zoom = '12'  # Choose an appropriate zoom level

map_image_path = generate_map_image(center, zoom, api_key, coordinates)
print(map_image_path)
if map_image_path:
    create_pdf(title, short_link, map_image_path, addresses)
else:
    print("Failed to create map image.")
