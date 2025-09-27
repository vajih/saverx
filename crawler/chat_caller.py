#!/usr/bin/env python3
"""
Goal of this file is to have several interfaces to call chatgpt. e.g. different types of webssites
"""

from openAi import call_chatgpt
import json

def extract_program_info_basic(text):
    """
    Sends scraped text to GPT to extract information
    in structured JSON format.
    """

    instruction = (
        "Extract the following information from this text. "
        "Return ONLY valid JSON."
    )
    json_format = """
        The JSON should be a list of objects with these fields:

        [
        {
            "Drug Name": "string",
            "Manufacturer": "string",
            "Program Type": "string",
            "Eligibility": "string",
            "Discount": "string",
            "Application Link": "string"
        }
        ]
        """

    text_section = f'Text to extract from:\n"""{text}"""'

    limitations = "Output ONLY JSON, no explanations or extra text."

    final_prompt = "\n\n".join([instruction, json_format, text_section, limitations])

    max_tokens = 500
    response = call_chatgpt(final_prompt, max_tokens=max_tokens)

    try:
        data = json.loads(response)
        return data
    except json.JSONDecodeError:
        print("Failed to parse GPT response as JSON. Raw output:")
        print(response)
        return None

