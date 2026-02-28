# SVG Logo Designer Skill

Create professional, scalable vector graphic (SVG) logos with multiple variations and layouts.

## Overview

This skill generates professional SVG logos from design specifications, providing multiple concepts, layout variations, and comprehensive usage guidelines.

## Key Features

- **Multiple Concepts**: 3-5 different design directions
- **Layout Variations**: Horizontal, vertical, square, icon-only, text-only
- **Color Variations**: Full color, monochrome, reversed
- **Professional SVG Code**: Clean, optimized, accessible
- **Usage Guidelines**: Complete documentation for proper logo usage
- **Export Instructions**: SVG to PNG conversion guidance
- **Scalable Designs**: Works at any size without quality loss

## Logo Types Supported

### Wordmark
Text-based logos (Google, Coca-Cola style)
- Typography-focused
- Brand name as primary element
- Best for: Distinctive names

### Lettermark
Initials/abbreviation logos (IBM, HBO style)
- Condensed brand representation
- Memorable monograms
- Best for: Long names

### Pictorial Mark
Icon/symbol logos (Apple, Twitter style)
- Recognizable imagery
- Strong visual identity
- Best for: Established brands

### Abstract Mark
Abstract geometric logos (Pepsi, Adidas style)
- Unique visual forms
- Modern and versatile
- Best for: Tech, innovative brands

### Combination Mark
Icon + text logos (Burger King, Lacoste style)
- Flexibility in applications
- Clear brand communication
- Best for: Most businesses

### Emblem
Text inside symbol (Starbucks, Harley-Davidson style)
- Traditional and classic
- Badge-like appearance
- Best for: Organizations, schools

## Workflow

### Phase 1: Requirements Gathering
- Brand information and industry
- Target audience
- Design preferences and style
- Color palette
- Logo type preference
- Number of concepts needed

### Phase 2: Concept Development
- Create 3-5 unique concepts
- Different visual approaches
- Various style treatments
- Explore visual metaphors

### Phase 3: Layout Variations
For each concept:
- Horizontal lockup (website headers)
- Vertical lockup (social media)
- Square/centered (app icons)
- Icon only (small sizes)
- Text only (minimal applications)

### Phase 4: SVG Generation
- Clean, semantic SVG code
- Optimized paths and shapes
- Accessible with title/desc elements
- Color management with CSS classes
- Scalable viewBox

### Phase 5: Presentation
- Design rationale for each concept
- SVG code for all variations
- Usage context explanations
- Color specifications

### Phase 6: Deliverables
- All SVG files (30-75 typically)
- Usage guidelines
- Technical specifications
- Export instructions
- Optional mockups

## Color Psychology

**Blue** - Trust, professionalism, stability
- Finance, technology, healthcare

**Green** - Growth, health, eco-friendly
- Environment, wellness, finance

**Red** - Energy, passion, urgency
- Food, entertainment, retail

**Purple** - Creativity, luxury, spirituality
- Beauty, tech, creative industries

**Orange** - Friendly, energetic, affordable
- Retail, food, entertainment

**Yellow** - Optimism, clarity, warmth
- Food, children, energy

**Black/Gray** - Sophisticated, modern, classic
- Luxury, fashion, technology

## Installation

```bash
/plugin marketplace add rknall/claude-skills
/plugin install svg-logo-designer
```

## Example Usage

### Tech Startup Logo
```
Create a logo for "CloudSync", a cloud storage startup.

Industry: Technology, SaaS
Style: Modern, trustworthy, clean
Colors: Blue tones preferred
Type: Combination mark (icon + text)
Concepts: 3-4 different approaches

Include horizontal, vertical, and icon-only layouts.
```

### Restaurant Logo
```
Design a logo for "Bella Cucina", an Italian restaurant.

Industry: Food & dining, Italian cuisine
Style: Elegant, traditional, warm
Colors: Red, green, gold
Type: Emblem or combination mark
Concepts: 3 concepts

Need full color and monochrome versions.
```

### Fitness Brand Logo
```
Create a logo for "PeakFit", a fitness coaching service.

Industry: Health & fitness
Style: Bold, energetic, motivational
Colors: Vibrant orange and black
Type: Abstract mark or lettermark
Concepts: 4 different directions

Must work well on merchandise.
```

## SVG to PNG Export

### Option 1: Using Inkscape (Free)
```bash
inkscape logo.svg --export-png=logo.png --export-width=1000
```

### Option 2: Using ImageMagick
```bash
convert -background none logo.svg logo.png
```

### Option 3: Online Converter
- CloudConvert: https://cloudconvert.com/svg-to-png
- Vectr: https://vectr.com/
- SVGtoPNG: https://svgtopng.com/

### Option 4: Design Tools
- Adobe Illustrator: File → Export → PNG
- Figma: Import SVG, export as PNG
- Sketch: Import SVG, export as PNG

## File Naming Convention

```
brand-name-logo-concept1-horizontal.svg
brand-name-logo-concept1-vertical.svg
brand-name-logo-concept1-icon.svg
brand-name-logo-concept1-horizontal-monochrome.svg
brand-name-logo-concept2-horizontal.svg
```

## Usage Guidelines Included

Every logo package includes:

### Clear Space Rules
- Minimum distance around logo
- No text or graphics in clear space

### Minimum Sizes
- Digital: 100px width minimum
- Print: 1 inch width minimum

### Color Specifications
- Hex codes for all colors
- Pantone equivalents (if requested)
- CMYK values for print

### Incorrect Usage Examples
- Don't stretch or distort
- Don't change colors
- Don't add effects
- Don't rotate/skew
- Don't use on busy backgrounds

### Application Examples
- Website headers
- Business cards
- Social media profiles
- Print materials
- Merchandise

## Best Practices

Great logos are:
- **Simple**: Easy to recognize and remember
- **Memorable**: Unique and distinctive
- **Timeless**: Won't look dated quickly
- **Versatile**: Works across all applications
- **Appropriate**: Fits the brand and industry

## Deliverables

1. **SVG Files** (30-75 files)
   - 3-5 concepts
   - 3-5 layouts per concept
   - 3-4 color variations

2. **Documentation**
   - Design rationale for each concept
   - Usage guidelines
   - Color specifications
   - Technical specs

3. **Export Instructions**
   - SVG to PNG conversion
   - File organization
   - Web implementation examples

4. **Optional: Mockups**
   - Logo on business card
   - Logo on website
   - Logo on merchandise

## Design Templates

The skill includes example patterns for:
- Geometric icons
- Wordmarks
- Abstract marks
- Combination marks
- Emblems

See SKILL.md for complete code examples.

## Version History

- **1.0.0** (2025-10-18): Initial release
  - Multiple logo types supported
  - Layout variations system
  - Comprehensive usage guidelines
  - Professional SVG generation

## License

This skill is provided as-is for use with Claude Code.
