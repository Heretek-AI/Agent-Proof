export function generateRuffConfig(): string {
  return `# Ruff Configuration for Agent-Proof Mechanical Hard-Gate
line-length = 100
target-version = "py310"

[lint]
select = [
    "E",   # pycodestyle errors
    "W",   # pycodestyle warnings
    "F",   # pyflakes
    "I",   # isort
    "B",   # flake8-bugbear (catches common bugs/slop)
    "C4",  # flake8-comprehensions
    "UP",  # pyupgrade
    "SIM", # flake8-simplify
]
ignore = []

[lint.per-file-ignores]
"__init__.py" = ["F401"]

[format]
quote-style = "double"
indent-style = "space"
`;
}
