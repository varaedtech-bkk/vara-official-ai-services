import AssistantExperience from '@/components/AssistantExperience';

export default function Page() {
  // No height/min-height wrapper here on purpose: AssistantExperience owns the
  // single 100dvh stage. A `min-h-screen` wrapper would fight it and push the
  // bottom-anchored suggestions and controls below the fold on short screens.
  return (
    <>
      {/* Organisation schema helps AI answer engines cite VARA correctly —
          the same AEO practice VARA sells to clients. */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'Organization',
            name: 'VARA EdTech Co., Ltd.',
            alternateName: 'VARA EdTech',
            url: 'https://varaedtech.com',
            logo: 'https://varaedtech.com/logo.png',
            email: 'info@varaedtech.com',
            telephone: '+66948877955',
            foundingDate: '2021',
            founder: { '@type': 'Person', name: 'Sunjay Kumar' },
            address: {
              '@type': 'PostalAddress',
              streetAddress: '5th Floor, Forum Tower, 184 Ratchadaphisek Rd, Huai Khwang',
              addressLocality: 'Bangkok',
              postalCode: '10310',
              addressCountry: 'TH',
            },
            description:
              'VARA EdTech is a Bangkok-based AI and immersive technology company building AI services, VR/AR applications and custom software for universities, businesses and government across 13 countries.',
            knowsAbout: [
              'Answer Engine Optimization',
              'Voice AI assistants',
              'AI chatbots',
              'Business automation',
              'VR/AR education',
              'Custom AI models',
              '3D configurators',
            ],
            sameAs: ['https://siamtechmedia.com', 'https://xm3dview.com'],
          }),
        }}
      />
      <AssistantExperience />
    </>
  );
}
