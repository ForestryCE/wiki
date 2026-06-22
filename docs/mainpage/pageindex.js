---
# Auto-generated search index: hardcoded core pages + every bee in the collection.
# Consumed by mainpage.js (Fuse over title/desc).
---
const data = [
  { title: "Main Page", link: "{{ '/' | absolute_url }}", desc: "The very Home of Forestry:CE Wiki" },
  {%- for bee in site.bees %}
  { title: {{ bee.title | jsonify }}, link: "{{ bee.url | absolute_url }}", desc: {{ bee.og_description | default: bee.title | jsonify }} },
  {%- endfor %}
]
