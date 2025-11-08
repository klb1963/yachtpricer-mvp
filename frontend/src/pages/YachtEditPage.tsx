// frontend/src/pages/YachtEditPage.tsx

import { useParams } from 'react-router-dom';
import YachtEditForm from '../components/yacht_edit_form/YachtEditForm';

export default function YachtEditPage() {
  const { id } = useParams();
  return <YachtEditForm yachtId={id ?? null} />;
}