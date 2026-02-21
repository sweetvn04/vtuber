import warnings
warnings.filterwarnings("ignore")  # tắt warning của ddgs/duckduckgo

def web_search(query: str, max_results: int = 3) -> str:
    """
    Tìm kiếm web bằng DuckDuckGo và trả về kết quả dạng text.
    Thử ddgs trước (package mới), fallback về duckduckgo_search cũ.
    """
    try:
        # Thử dùng ddgs (package mới, được khuyến nghị)
        from ddgs import DDGS
        with DDGS() as ddgs:
            results = list(ddgs.text(query, max_results=max_results))
    except ImportError:
        # Fallback về duckduckgo_search cũ
        from duckduckgo_search import DDGS
        with DDGS() as ddgs:
            results = list(ddgs.text(query, max_results=max_results))

    if not results:
        return "No results found."

    # Format thành text để nhét vào prompt
    output = ""
    for i, r in enumerate(results):
        title = r.get('title', 'No title')
        url   = r.get('href', r.get('url', ''))
        body  = r.get('body', r.get('description', 'No description'))
        output += f"[{i+1}] {title}\n{url}\n{body}\n\n"

    return output.strip()