import HomeButton from '../components/HomeButton'
import CreateLeadForm from '../components/CreateLeadForm';

export default function ManagerCreateLead() {
  return (
    <>
      <HomeButton to="/mgr" />
      <CreateLeadForm />
    </>
  );
}