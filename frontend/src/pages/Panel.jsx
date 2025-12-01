import Navbar from "../layouts/Navbar";
import Rack from "../pages/Rack"; // lo crearemos ahorita

export default function Panel() {
  return (
    <div>
      <Navbar />

      <div style={{ padding: "20px" }}>
        <Rack />
      </div>
    </div>
  );
}
