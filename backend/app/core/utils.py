import re
from decimal import ROUND_HALF_UP, Decimal

_TRANSLIT = {
    "а": "a", "б": "b", "в": "v", "г": "g", "д": "d", "е": "e", "ё": "e", "ж": "zh",
    "з": "z", "и": "i", "й": "y", "к": "k", "л": "l", "м": "m", "н": "n", "о": "o",
    "п": "p", "р": "r", "с": "s", "т": "t", "у": "u", "ф": "f", "х": "kh", "ц": "ts",
    "ч": "ch", "ш": "sh", "щ": "shch", "ъ": "", "ы": "y", "ь": "", "э": "e", "ю": "yu",
    "я": "ya",
}  # fmt: skip


def slugify(value: str, max_length: int = 200) -> str:
    value = value.lower().strip()
    value = "".join(_TRANSLIT.get(ch, ch) for ch in value)
    value = re.sub(r"[^a-z0-9]+", "-", value).strip("-")
    return value[:max_length].strip("-") or "item"


def parse_price(text: str | None) -> Decimal | None:
    if not text:
        return None
    cleaned = re.sub(r"[^\d,.]", "", text.replace("\xa0", "")).replace(",", ".")
    if not cleaned:
        return None
    try:
        value = Decimal(cleaned)
    except ArithmeticError:
        return None
    return value if value > 0 else None


def round_money(value: Decimal | float | int) -> Decimal:
    return Decimal(value).quantize(Decimal("1"), rounding=ROUND_HALF_UP)


def normalize_phone(phone: str) -> str:
    digits = re.sub(r"\D", "", phone)
    if len(digits) == 11 and digits[0] in "78":
        return f"+7 ({digits[1:4]}) {digits[4:7]}-{digits[7:9]}-{digits[9:11]}"
    return phone.strip()
