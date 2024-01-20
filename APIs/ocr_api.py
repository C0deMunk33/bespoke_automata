# pip install surya-ocr

from PIL import Image
from surya.detection import batch_inference
from surya.model.segformer import load_model, load_processor


IMAGE_PATH = "./image_test.png"
image = Image.open(IMAGE_PATH)
model, processor = load_model(), load_processor()

# predictions is a list of dicts, one per image
predictions = batch_inference([image], model, processor)
print(predictions[0])