# pip install surya-ocr
# sudo apt install tesseract-ocr
#sudo apt install libtesseract-dev

from PIL import Image
from surya.detection import batch_inference
from surya.model.segformer import load_model, load_processor
import pytesseract

IMAGE_PATH = "./image_test.png"
image = Image.open(IMAGE_PATH)
model, processor = load_model(), load_processor()

# predictions is a list of dicts, one per image
predictions = batch_inference([image], model, processor)
print(predictions[0])

# predicitons[0]["polygons"] is an array of arrays of points, each array of points is a polygon each of an array where 0 is x and 1 is y
# so: predictions[0]["polygons"][0][0][0] is the x of the first point of the first polygon
# so: predictions[0]["polygons"][0][0][1] is the y of the first point of the first polygon
''' example of predictions[0]["polygons"]:
[
    [
        [1343, 158], [1492, 158], [1492, 177], [1343, 177]
    ], [
        [264, 362], [346, 362], [346, 387], [264, 387]
    ], [
        [47, 365], [271, 365], [271, 389], [47, 389]
    ], [
        [50, 413], [135, 413], [135, 436], [50, 436]
    ], [
        [1618, 530], [1754, 530], [1754, 550], [1618, 550]
    ], [
        [1414, 545], [1570, 545], [1570, 563], [1414, 563]
    ], [[1838, 585], [2001, 585], [2001, 607], [1838, 607]], [[2107, 589], [2314, 591], [2313, 609], [2105, 608]], [[2113, 616], [2235, 616], [2235, 632], [2113, 632]], [[2218, 707], [2378, 707], [2378, 724], [2218, 724]], [[1988, 905], [2503, 905], [2503, 933], [1988, 933]], [[1391, 1165], [1821, 1165], [1821, 1194], [1391, 1194]], [[1363, 1256], [1570, 1256], [1570, 1276], [1363, 1276]], [[57, 1264], [244, 1264], [244, 1286], [57, 1286]], [[2731, 1266], [2955, 1266], [2955, 1286], [2731, 1286]], [[888, 1277], [1146, 1277], [1146, 1296], [888, 1296]], [[2056, 1278], [2313, 1278], [2313, 1297], [2056, 1297]], [[2914, 1625], [2975, 1625], [2975, 1683], [2914, 1683]], [[1706, 1630], [1777, 1630], [1777, 1643], [1706, 1643]], [[1703, 1642], [1774, 1642], [1774, 1668], [1703, 1668]], [[1547, 1686], [1713, 1686], [1713, 1705], [1547, 1705]], [[943, 1701], [1190, 1701], [1190, 1718], [943, 1718]], [[1781, 1766], [2100, 1766], [2100, 1789], [1781, 1789]], [[1353, 1779], [1686, 1779], [1686, 1811], [1353, 1811]], [[2683, 1831], [3006, 1831], [3006, 1865], [2683, 1865]], [[2894, 1881], [3006, 1881], [3006, 1898], [2894, 1898]], [[1170, 1885], [1567, 1885], [1567, 1912], [1170, 1912]], [[1813, 1891], [2024, 1889], [2027, 1910], [1816, 1913]], [[2374, 1897], [2666, 1897], [2666, 1926], [2374, 1926]], [[1734, 1905], [2084, 1908], [2082, 1926], [1732, 1924]], [[1228, 1927], [1503, 1927], [1503, 1955], [1228, 1955]], [[1615, 1937], [1689, 1937], [1689, 1950], [1615, 1950]], [[1177, 1957], [1557, 1957], [1557, 1986], [1177, 1986]], [[2897, 1959], [3006, 1959], [3006, 1978], [2897, 1978]], [[2307, 1967], [2734, 1967], [2734, 1995], [2307, 1995]], [[1167, 1987], [1577, 1987], [1577, 2017], [1167, 2017]], [[2330, 1995], [2714, 1995], [2714, 2022], [2330, 2022]]]
'''

def ocr(image):
    # do OCR here using pytesseract
    text = pytesseract.image_to_string(image)                                         
    return text


# for each polygon, cut the image and save it
for polygon in predictions[0]["polygons"]:
    # cut chunk of image
    x_min = min([point[0] for point in polygon])
    x_max = max([point[0] for point in polygon])
    y_min = min([point[1] for point in polygon])
    y_max = max([point[1] for point in polygon])
    # expand the box a bit
    x_min -= 10
    x_max += 10
    y_min -= 10
    y_max += 10
    # crop image
    cropped_image = image.crop((x_min, y_min, x_max, y_max))
    # display image in console
    # cropped_image.show()
    # send to OCR
    text = ocr(cropped_image)
    print(text)