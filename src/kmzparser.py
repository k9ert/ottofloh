from pykml import parser
from zipfile import ZipFile, BadZipFile
import os
import shutil
from lxml import etree

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
        coordinates_with_styles = []
        
        # Find all Placemarks using xpath with namespace
        ns = {'kml': 'http://www.opengis.net/kml/2.2'}
        placemarks = doc.xpath('.//kml:Placemark', namespaces=ns)
        
        for placemark in placemarks:
            try:
                name = placemark.xpath('./kml:name/text()', namespaces=ns)[0]
                coords = placemark.xpath('.//kml:coordinates/text()', namespaces=ns)[0].strip().split(',')
                style_url = placemark.xpath('./kml:styleUrl/text()', namespaces=ns)[0]
                coordinates_with_styles.append((coords[1], coords[0], style_url))  # lat, lon, styleUrl
            except (IndexError, AttributeError) as e:
                print(f"Warning: Skipping placemark due to missing data: {e}")
                continue
                
        return coordinates_with_styles

def parse_kml_addresses():
    with open(kml_file_path, 'rb') as kml_file:
        doc = parser.parse(kml_file).getroot()
        addresses = []
        
        # Find all Placemarks using xpath with namespace
        ns = {'kml': 'http://www.opengis.net/kml/2.2'}
        placemarks = doc.xpath('.//kml:Placemark', namespaces=ns)
        
        for placemark in placemarks:
            try:
                name = placemark.xpath('./kml:name/text()', namespaces=ns)[0]
                addresses.append(name)
            except (IndexError, AttributeError) as e:
                print(f"Warning: Skipping placemark due to missing data: {e}")
                continue
                
        return addresses
    
init()
print(extracted)
