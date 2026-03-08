import { SkillForm } from "@/components/skills/SkillForm";

export default function AdminNewSkillPage() {
  return (
    <div className="max-w-2xl mx-auto py-8">
      <SkillForm adminMode />
    </div>
  );
}
