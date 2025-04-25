from pykml import parser
from zipfile import ZipFile, BadZipFile
import os
import shutil

extracted = False
kml_file_path = ""

def init():
    global extracted
    global kml_file_path
    if not extracted:
        kml_file_path = process_input_file('data.kmz')
        print("Processing KML file: " + kml_file_path)
        extracted = True

def process_input_file(file_path):
    # Create build directory if it doesn't exist
    os.makedirs('build/kmz_content', exist_ok=True)
    
    try:
        # First try to process as KMZ
        with ZipFile(file_path, 'r') as kmz:
            kmz.extractall('build/kmz_content')
            for filename in kmz.namelist():
                if filename.endswith('.kml'):
                    return f'build/kmz_content/{filename}'
    except BadZipFile:
        # If not a zip file, assume it's KML
        print("Input is not a KMZ file, treating as KML")
        kml_path = 'build/kmz_content/doc.kml'
        shutil.copy2(file_path, kml_path)
        return kml_path
    
    return None

def parse_kml_coordinates():
    with open(kml_file_path, 'rb') as kml_file:
        doc = parser.parse(kml_file).getroot()
        # Implement namespace handling if needed
        coordinates_with_styles = []
        print("yeah")
        print(str(doc.Document.name.text))
        print(str(doc.Document.Placemark.name.text))
        print("iterating ...")
        for placemark in doc.Document.Placemark:
            name = placemark.name.text
            coord = placemark.Point.coordinates.text.strip().split(',')
            styleUrl = placemark.styleUrl.text  # Extract the styleUrl.
            coordinates_with_styles.append((coord[1], coord[0], styleUrl))  # lat, lon, styleUrl
    return coordinates_with_styles

def parse_kml_addresses():
    with open(kml_file_path, 'rb') as kml_file:
        doc = parser.parse(kml_file).getroot()
        # Implement namespace handling if needed
        addresses = []
        print("yeah")
        print(str(doc.Document.name.text))
        print(str(doc.Document.Placemark.name.text))
        print("iterating ...")
        for placemark in doc.Document.Placemark:
            name = placemark.name.text
            # Extract coordinates and any other necessary details
            coord = placemark.Point.coordinates.text.strip().split(',')
            addresses.append(name)
        return addresses
    
init()
print(extracted)
