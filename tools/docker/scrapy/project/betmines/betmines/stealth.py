"""playwright-stealth applied per page — handles both old and new package APIs."""


async def init_stealth(page, request):
    # Newer playwright-stealth (>=2.x): Stealth().apply_stealth_async
    try:
        from playwright_stealth import Stealth
        await Stealth().apply_stealth_async(page)
        return
    except Exception:
        pass
    # Older playwright-stealth (1.x): stealth_async
    try:
        from playwright_stealth import stealth_async
        await stealth_async(page)
    except Exception:
        pass
