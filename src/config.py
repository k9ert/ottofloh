import yaml

def read_api_key_from_yaml(key_name, file_path='secrets.yaml'):
    """
    Reads the specified key from the given YAML file.

    Args:
    key_name (str): The key to retrieve from the YAML file.
    file_path (str, optional): Path to the YAML file. Defaults to 'secrets.yml'.

    Returns:
    str or None: The value associated with the key or None if an error occurs.
    """
    try:
        with open(file_path, 'r') as yaml_file:
            data = yaml.safe_load(yaml_file)  # Load the yaml file's contents
            return data.get(key_name)  # Return the value of the specified key
    except FileNotFoundError:
        print(f"Error: The file '{file_path}' was not found.")
        return None
    except yaml.YAMLError as e:
        print(f"An error occurred while parsing the YAML file: {e}")
        return None
    except Exception as e:
        print(f"An unknown error occurred: {e}")
        return None