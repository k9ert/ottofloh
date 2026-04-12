from pykml import parser
from zipfile import ZipFile, BadZipFile
import os
import shutil
import requests
from lxml import etree
from config import read_api_key_from_yaml

_geocode_cache = {}

def _geocode(address):
    if address in _geocode_cache:
        return _geocode_cache[address]
    api_key = read_api_key_from_yaml('api_key')
    resp = requests.get(
        "https://maps.googleapis.com/maps/api/geocode/json",
        params={'address': address, 'key': api_key},
        timeout=10,
    )
    resp.raise_for_status()
    data = resp.json()
    if data.get('status') != 'OK' or not data.get('results'):
        raise RuntimeError(f"Geocoding failed for {address!r}: {data.get('status')}")
    loc = data['results'][0]['geometry']['location']
    result = (loc['lat'], loc['lng'])
    _geocode_cache[address] = result
    return result

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
                style_url_list = placemark.xpath('./kml:styleUrl/text()', namespaces=ns)
                style_url = style_url_list[0] if style_url_list else ''

                coords_text = placemark.xpath('.//kml:coordinates/text()', namespaces=ns)
                if coords_text:
                    parts = coords_text[0].strip().split(',')
                    lat, lon = parts[1], parts[0]
                else:
                    address_text = placemark.xpath('./kml:address/text()', namespaces=ns)
                    if not address_text:
                        raise ValueError("placemark has neither <coordinates> nor <address>")
                    lat_f, lon_f = _geocode(address_text[0])
                    lat, lon = str(lat_f), str(lon_f)

                coordinates_with_styles.append((lat, lon, style_url))  # lat, lon, styleUrl
            except (IndexError, AttributeError, ValueError, RuntimeError) as e:
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
