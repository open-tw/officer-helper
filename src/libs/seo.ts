export const seo = ({
  title,
  description,
  keywords,
  image,
  path = '',
}: {
  title: string
  description?: string
  image?: string
  keywords?: string
  path?: string
}) => {
  const primaryTitle = `${title} - 辦公室小幫手`
  const tags = [
    { title: primaryTitle },
    { name: 'description', content: description },
    { name: 'keywords', content: keywords },
    { name: 'twitter:title', content: primaryTitle },
    { name: 'twitter:description', content: description },
    { property: 'og:type', content: 'website' },
    // { property: 'og:url', content: `${HOST}${path}` },
    { property: 'og:title', content: primaryTitle },
    { property: 'og:description', content: description },
    // ...(image
    //   ? [
    //       { name: 'twitter:image', content: resolveImageUrl(image) },
    //       { name: 'twitter:card', content: 'summary_large_image' },
    //       { property: 'og:image', content: resolveImageUrl(image) },
    //     ]
    //   : []),
  ]

  return tags
}
