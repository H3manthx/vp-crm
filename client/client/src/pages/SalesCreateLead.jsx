import HomeButton from '../components/HomeButton'
import CreateLeadForm from '../components/CreateLeadForm';

export default function SalesCreateLead() {
  return (
    <>
      <HomeButton to="/mgr" />
      <CreateLeadForm />
    </>
  );
}