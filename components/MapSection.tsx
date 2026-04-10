export default function MapSection() {
  return (
    <section className="w-full">
      <iframe
        src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d2808.952530282901!2d19.795792112493817!3d45.248752670950566!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x475b116b6f148971%3A0xbae20345f88572f7!2sInfinity%20Laser%20Studio!5e0!3m2!1sen!2srs!4v1775850629842!5m2!1sen!2srs"
        width="100%"
        height="450"
        style={{ border: 0, display: "block" }}
        allowFullScreen
        loading="lazy"
        referrerPolicy="no-referrer-when-downgrade"
        title="Infinity Laser Studio lokacija"
      />
    </section>
  );
}
